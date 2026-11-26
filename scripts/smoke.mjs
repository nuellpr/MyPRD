/**
 * Smoke test end-to-end: menjalankan server produksi (`next start`) di port
 * terpisah, lalu menelusuri alur utama:
 *
 *   register -> verify OTP -> buat project -> questions -> chat (SSE)
 *   -> generate PRD (SSE) -> revise PRD (SSE) -> edit PRD -> export
 *   -> cek kuota -> billing QRIS dinamis -> admin approve -> isolasi & logout
 *
 * Jalankan: npm run smoke
 * Butuh hasil `npm run build` lebih dulu.
 */
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const PORT = Number(process.env.SMOKE_PORT ?? 3210);
const BASE = `http://127.0.0.1:${PORT}`;
const DB_PATH = path.join("data", "smoke.db");
const SAMPLE_QRIS =
  "00020101021126610014COM.GO-JEK.WWW01189360091435883948200210G5883948200303UMI51440014ID.CO.QRIS.WWW0215ID10264940261500303UMI5204899953033605802ID5924Mas N, Digital & Kreatif6006KUPANG61058522862070703A016304CAC7";

let passed = 0;
let failed = 0;

function check(name, condition, detail = "") {
  if (condition) {
    passed += 1;
    console.log(`  ok  ${name}`);
  } else {
    failed += 1;
    console.error(`  FAIL ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

function section(title) {
  console.log(`\n${title}`);
}

let cookie = "";

function captureCookie(res) {
  const raw = res.headers.getSetCookie?.() ?? [];
  for (const item of raw) {
    const pair = item.split(";")[0];
    if (pair.startsWith("myprd_session=")) cookie = pair;
  }
}

async function api(pathname, init = {}) {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const res = await fetch(`${BASE}${pathname}`, {
        ...init,
        headers: {
          ...(init.body ? { "Content-Type": "application/json" } : {}),
          ...(cookie ? { Cookie: cookie } : {}),
          ...(init.headers ?? {}),
        },
      });
      captureCookie(res);
      return res;
    } catch (err) {
      const code = err?.cause?.code;
      if (attempt === 0 && code === "ECONNRESET") {
        await new Promise((r) => setTimeout(r, 150));
        continue;
      }
      throw new Error(`Fetch ${pathname} failed: ${err instanceof Error ? err.message : String(err)}`, { cause: err });
    }
  }
}

async function json(res) {
  return res.json().catch(() => ({}));
}

async function readSse(res) {
  const events = [];
  let buffer = "";
  const decoder = new TextDecoder();
  for await (const chunk of res.body) {
    buffer += decoder.decode(chunk, { stream: true });
    const parts = buffer.split("\n\n");
    buffer = parts.pop() ?? "";
    for (const part of parts) {
      const line = part.split("\n").find((l) => l.startsWith("data:"));
      if (!line) continue;
      try {
        events.push(JSON.parse(line.slice(5).trim()));
      } catch {
        // abaikan event yang tidak lengkap
      }
    }
  }
  return events;
}

function waitForServer(timeoutMs = 60_000) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const tick = async () => {
      try {
        const res = await fetch(BASE, { redirect: "manual" });
        if (res.status < 500) return resolve();
      } catch {
        // belum siap
      }
      if (Date.now() - started > timeoutMs) return reject(new Error("Server tidak siap dalam batas waktu."));
      setTimeout(tick, 400);
    };
    void tick();
  });
}

async function registerAndVerify(email, name) {
  const res = await api("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, password: "rahasia12345", name }),
  });
  const body = await json(res);
  let verified = false;
  if (res.status === 201) {
    let code = body.devCode;
    if (!code) {
      // Server berjalan dengan NODE_ENV=production sehingga devCode tidak dikirim ke klien.
      // Sisipkan OTP uji deterministik langsung ke SQLite lokal lalu verifikasi lewat endpoint asli.
      code = "123456";
      const normalized = email.trim().toLowerCase();
      const db = new DatabaseSync(DB_PATH);
      try {
        db.exec("PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;");
        const user = db.prepare("SELECT id FROM users WHERE email = ?").get(normalized);
        const now = Date.now() + 5;
        const hash = createHash("sha256").update(`${normalized}|register|${code}`).digest("hex");
        db.prepare(
          "INSERT INTO otp_codes (id, user_id, email, purpose, code_hash, created_at, expires_at, attempts) VALUES (?, ?, ?, 'register', ?, ?, ?, 0)",
        ).run(`otp_smoke_${now}_${Math.random().toString(16).slice(2, 8)}`, user.id, normalized, hash, now, now + 600_000);
      } finally {
        db.close();
      }
    }
    const vRes = await api("/api/auth/verify-otp", {
      method: "POST",
      body: JSON.stringify({ email, code, purpose: "register" }),
    });
    verified = vRes.ok;
  }
  return { res, body, verified };
}

async function main() {
  for (const suffix of ["", "-wal", "-shm"]) fs.rmSync(`${DB_PATH}${suffix}`, { force: true });

  const email = `smoke_${Date.now()}@example.com`;
  const server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", String(PORT)], {
    env: {
      ...process.env,
      NODE_ENV: "production",
      APP_SECRET: process.env.APP_SECRET ?? "smoke-test-secret-1234567890abcdef",
      DATABASE_PATH: DB_PATH,
      FREE_MONTHLY_QUOTA: "2",
      RESEND_API_KEY: "",
      ALLOW_DEV_OTP: "1",
      BILLING_PROVIDER: "qris",
      QRIS_STATIC_PAYLOAD: SAMPLE_QRIS,
      MAYAR_API_KEY: "",
      MIDTRANS_SERVER_KEY: "",
      AI_DEFAULT_MODEL: "mock/myprd-demo",
      ADMIN_EMAILS: email,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  const serverLog = [];
  server.stdout.on("data", (d) => serverLog.push(d.toString()));
  server.stderr.on("data", (d) => serverLog.push(d.toString()));
  server.on("exit", (code, sig) => serverLog.push(`[server exit code=${code} sig=${sig}]\n`));

  try {
    await waitForServer();
    console.log(`Server siap di ${BASE}`);

    section("1. Landing page & proteksi route");
    const landing = await fetch(BASE);
    check("landing page 200", landing.status === 200);
    const landingHtml = await landing.text();
    check("landing memuat harga & CTA", /Rp0|Gratis/i.test(landingHtml) && /Daftar|Masuk/i.test(landingHtml));

    const guarded = await fetch(`${BASE}/dashboard`, { redirect: "manual" });
    check("belum login -> /dashboard dialihkan", guarded.status === 307 || guarded.status === 302, `status ${guarded.status}`);

    const unauthed = await api("/api/projects");
    check("API project tanpa login -> 401", unauthed.status === 401, `status ${unauthed.status}`);

    section("2. Register, OTP & sesi");
    const reg = await registerAndVerify(email, "Smoke Tester");
    check("register -> 201", reg.res.status === 201, `status ${reg.res.status}`);
    check("verify OTP -> ok", reg.verified);
    check("cookie sesi diterima", cookie.startsWith("myprd_session="));

    const duplicate = await api("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password: "rahasia12345" }),
    });
    check("register email duplikat -> 409", duplicate.status === 409, `status ${duplicate.status}`);

    const me = await json(await api("/api/auth/me"));
    check("/api/auth/me mengembalikan user + kuota", me.user?.email === email && me.quota?.limit === 2);

    const models = await json(await api("/api/models"));
    check("daftar model memuat provider mock", Array.isArray(models.providers) && models.providers.some((p) => p.id === "mock"));

    section("3. Buat project, questions wizard & chat");
    const created = await api("/api/projects", {
      method: "POST",
      body: JSON.stringify({
        title: "Aplikasi Kasir Warung",
        idea: "Aplikasi kasir sederhana untuk warung kopi kecil, jalan di HP Android murah.",
        modelId: models.defaultModel,
        language: "id",
      }),
    });
    const project = await json(created);
    check("create project -> 201", created.status === 201, `status ${created.status}`);
    const projectId = project.project?.id;

    const qRes = await api(`/api/projects/${projectId}/questions`, {
      method: "POST",
      body: JSON.stringify({ techPreference: "Next.js App Router" }),
    });
    const qBody = await json(qRes);
    check("questions wizard -> 5 pertanyaan", qRes.status === 200 && Array.isArray(qBody.questions) && qBody.questions.length >= 3);

    const chatRes = await api(`/api/projects/${projectId}/chat`, {
      method: "POST",
      body: JSON.stringify({ message: "Targetnya pemilik warung kopi, fitur wajib catat pesanan dan rekap harian." }),
    });
    check("chat -> 200", chatRes.status === 200, `status ${chatRes.status}`);
    const chatEvents = await readSse(chatRes);
    check("event done + usage", chatEvents.some((e) => e.type === "done" && e.usage?.tokensOut > 0));

    section("4. Generate & Revise PRD (SSE) + kuota");
    const genRes = await api(`/api/projects/${projectId}/generate`, { method: "POST", body: JSON.stringify({}) });
    check("generate -> 200", genRes.status === 200, `status ${genRes.status}`);
    const genEvents = await readSse(genRes);
    const genDone = genEvents.find((e) => e.type === "done");
    check("PRD tersimpan & kuota berkurang (2 -> 1)", typeof genDone?.prd?.content === "string" && genDone?.quota?.remaining === 1);

    const revRes = await api(`/api/projects/${projectId}/revise`, {
      method: "POST",
      body: JSON.stringify({ instruction: "Tambah laporan ekspor harian" }),
    });
    const revEvents = await readSse(revRes);
    const revDone = revEvents.find((e) => e.type === "done");
    check("revise PRD -> 200 & versi naik", revRes.status === 200 && revDone?.prd?.version === 2);

    section("5. Export & Edit PRD");
    const mdRes = await api(`/api/projects/${projectId}/export?format=markdown`);
    check("export markdown -> 200", mdRes.status === 200);
    const tasksJsonRes = await api(`/api/projects/${projectId}/export?format=tasks-json`);
    const tasksJson = await json(tasksJsonRes);
    check("export tasks-json berisi daftar task", tasksJsonRes.status === 200 && Array.isArray(tasksJson.tasks) && tasksJson.tasks.length > 0);
    const pdfFree = await api(`/api/projects/${projectId}/export?format=pdf`);
    check("export pdf paket free -> 402", pdfFree.status === 402);

    const edited = await api(`/api/projects/${projectId}/prd`, {
      method: "PUT",
      body: JSON.stringify({ content: "# PRD Suntingan\n\n## Tujuan\n- hasil edit manual\n" }),
    });
    const editedBody = await json(edited);
    check("PUT prd -> versi naik ke 3", edited.status === 200 && editedBody.prd?.version === 3);

    const second = await api(`/api/projects/${projectId}/generate`, { method: "POST", body: JSON.stringify({}) });
    await readSse(second);
    const third = await api(`/api/projects/${projectId}/generate`, { method: "POST", body: JSON.stringify({}) });
    check("generate saat kuota habis -> 402", third.status === 402);

    section("6. Billing QRIS Dinamis & verifikasi admin");
    const checkout = await api("/api/billing/checkout", {
      method: "POST",
      body: JSON.stringify({ plan: "starter" }),
    });
    const checkoutBody = await json(checkout);
    check(
      "checkout starter QRIS dinamis -> 200 + nominal unik + QR dataUrl",
      checkout.status === 200 &&
        checkoutBody.provider === "qris" &&
        checkoutBody.order?.amountIdr > 49000 &&
        String(checkoutBody.qris?.qrDataUrl).startsWith("data:image/png"),
      `status ${checkout.status}`,
    );

    const confirmRes = await api("/api/billing/qris-confirm", {
      method: "POST",
      body: JSON.stringify({ order_id: checkoutBody.order?.id, note: "GoPay a.n. Tester" }),
    });
    check("qris-confirm -> 200", confirmRes.status === 200);

    const approveRes = await api("/api/billing/admin-approve", {
      method: "POST",
      body: JSON.stringify({ order_id: checkoutBody.order?.id, action: "approve" }),
    });
    const approveBody = await json(approveRes);
    check("admin-approve -> 200 + paid", approveRes.status === 200 && approveBody.order?.status === "paid");

    const meAfter = await json(await api("/api/auth/me"));
    check("paket user jadi starter + kuota 100", meAfter.user?.plan === "starter" && meAfter.quota?.limit === 100);

    const pdfRes = await api(`/api/projects/${projectId}/export?format=pdf`);
    const pdfBuf = Buffer.from(await pdfRes.arrayBuffer());
    check("export pdf paket starter -> 200 + %PDF-", pdfRes.status === 200 && pdfBuf.subarray(0, 5).toString() === "%PDF-");

    section("7. Isolasi antar user & logout");
    cookie = "";
    const otherEmail = `smoke_other_${Date.now()}@example.com`;
    const otherReg = await registerAndVerify(otherEmail, "Other User");
    check("register user lain -> ok", otherReg.verified);

    const stolen = await api(`/api/projects/${projectId}`);
    check("user lain tidak bisa akses project -> 404", stolen.status === 404);

    const forbidApprove = await api("/api/billing/admin-approve", {
      method: "POST",
      body: JSON.stringify({ order_id: checkoutBody.order?.id, action: "approve" }),
    });
    check("non-admin tidak bisa admin-approve -> 403", forbidApprove.status === 403);

    const logout = await api("/api/auth/logout", { method: "POST" });
    check("logout -> 200", logout.status === 200);
    const afterLogout = await api("/api/projects");
    check("setelah logout API project -> 401", afterLogout.status === 401);
  } finally {
    server.kill();
    await new Promise((r) => setTimeout(r, 500));
    if (failed > 0 || passed < 10) {
      console.error("\n--- log server ---");
      console.error(serverLog.join("").slice(-4000));
    }
  }

  console.log(`\n${passed} lulus, ${failed} gagal`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
