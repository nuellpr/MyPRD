/**
 * E2E dengan provider AI asli (default: Gemini).
 *
 * Menjalankan server produksi di port terpisah dengan DATABASE_PATH khusus,
 * lalu menelusuri alur: register → buat project → chat → generate PRD →
 * parse task breakdown → export.
 *
 * Jalankan: node scripts/e2e-live.mjs [modelId]
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const MODEL = process.argv[2] ?? "gemini/gemini-3.5-flash-lite";
const PORT = Number(process.env.E2E_PORT ?? 3301);
const BASE = `http://127.0.0.1:${PORT}`;
const DB_PATH = path.join("data", "e2e-live.db");

// Baca .env.local supaya API key tersedia untuk server.
function readEnvLocal() {
  const out = {};
  if (!fs.existsSync(".env.local")) return out;
  for (const line of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)$/);
    if (!m) continue;
    const value = m[2].trim().replace(/^["']|["']$/g, "");
    if (value) out[m[1]] = value;
  }
  return out;
}

let cookie = "";
function captureCookie(res) {
  for (const item of res.headers.getSetCookie?.() ?? []) {
    const pair = item.split(";")[0];
    if (pair.startsWith("myprd_session=")) cookie = pair;
  }
}

async function api(pathname, init = {}) {
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
}

const json = (res) => res.json().catch(() => ({}));

async function readSse(res, onEvent) {
  return (async () => {
    const events = [];
    let buffer = "";
    const decoder = new TextDecoder();
    const t0 = Date.now();
    for await (const chunk of res.body) {
      buffer += decoder.decode(chunk, { stream: true });
      const parts = buffer.split("\n\n");
      buffer = parts.pop() ?? "";
      for (const part of parts) {
        const line = part.split("\n").find((l) => l.startsWith("data:"));
        if (!line) continue;
        try {
          const event = JSON.parse(line.slice(5).trim());
          event.__t = (Date.now() - t0) / 1000;
          events.push(event);
          onEvent?.(event);
        } catch {
          /* abaikan */
        }
      }
    }
    return events;
  })();
}

function waitForServer(timeoutMs = 90_000) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const tick = async () => {
      try {
        const res = await fetch(BASE, { redirect: "manual" });
        if (res.status < 500) return resolve();
      } catch {
        /* belum siap */
      }
      if (Date.now() - started > timeoutMs) return reject(new Error("Server tidak siap."));
      setTimeout(tick, 400);
    };
    void tick();
  });
}

async function main() {
  for (const suffix of ["", "-wal", "-shm"]) fs.rmSync(`${DB_PATH}${suffix}`, { force: true });

  const envLocal = readEnvLocal();
  const server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", String(PORT)], {
    env: {
      ...process.env,
      ...envLocal,
      NODE_ENV: "production",
      DATABASE_PATH: DB_PATH,
      FREE_MONTHLY_QUOTA: "3",
      AI_DEFAULT_MODEL: MODEL,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  const log = [];
  server.stdout.on("data", (d) => log.push(d.toString()));
  server.stderr.on("data", (d) => log.push(d.toString()));

  let failures = 0;
  const check = (name, ok, detail = "") => {
    if (ok) console.log(`  ok   ${name}`);
    else {
      failures += 1;
      console.error(`  FAIL ${name}${detail ? ` — ${detail}` : ""}`);
    }
  };

  try {
    await waitForServer();
    console.log(`Server siap di ${BASE} (model: ${MODEL})\n`);

    console.log("1. Register & daftar model");
    const email = `live_${Date.now()}@example.com`;
    const reg = await api("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password: "rahasia12345", name: "Live Tester" }),
    });
    check("register 201", reg.status === 201, `status ${reg.status}`);
    const models = await json(await api("/api/models"));
    const providerIds = (models.providers ?? []).map((p) => p.id);
    console.log("   provider tersedia:", providerIds.join(", "));
    console.log("   default model:", models.defaultModel);
    check("default model = model yang diminta", models.defaultModel === MODEL, models.defaultModel);
    check("provider gemini tersedia", providerIds.includes("gemini"));

    console.log("\n2. Buat project dari ide");
    const idea =
      "Aplikasi manajemen stok dan kasir untuk toko kelontong kecil. Pemilik toko bisa scan barcode barang, catat penjualan harian, dan lihat laporan laba sederhana dari HP.";
    const created = await json(
      await api("/api/projects", {
        method: "POST",
        body: JSON.stringify({ title: "Stok & Kasir Toko Kelontong", idea, modelId: MODEL, language: "id" }),
      }),
    );
    const projectId = created.project?.id;
    check("project dibuat", String(projectId).startsWith("prj_"), JSON.stringify(created).slice(0, 200));

    console.log("\n3. Chat dengan model asli (SSE)");
    const turns = [
      "Pengguna utamanya pemilik toko kelontong yang jarang pakai komputer, semua dari HP Android. Fitur wajib versi pertama: scan barcode, catat penjualan, dan laporan harian. Batasan: rilis 4 minggu, web dulu.",
      "Belum ada, cukup tiga fitur itu dulu. Anggaran kecil, jadi pakai layanan yang murah.",
    ];
    let ready = false;
    let lastText = "";
    let chatUsage = null;
    for (let i = 0; i < turns.length; i += 1) {
      const t0 = Date.now();
      const res = await api(`/api/projects/${projectId}/chat`, {
        method: "POST",
        body: JSON.stringify({ message: turns[i] }),
      });
      check(`chat turn ${i + 1} → 200`, res.status === 200, `status ${res.status}`);
      const events = await readSse(res);
      const text = events.filter((e) => e.type === "delta").map((e) => e.text).join("");
      const done = events.find((e) => e.type === "done");
      const deltas = events.filter((e) => e.type === "delta").length;
      lastText = text;
      chatUsage = done?.usage;
      console.log(`   turn ${i + 1}: ${deltas} delta, ${text.length} karakter, ${((Date.now() - t0) / 1000).toFixed(1)}s, tokens ${JSON.stringify(done?.usage ?? {})}`);
      console.log(`   cuplikan: ${text.slice(0, 200).replace(/\n/g, " ")}...`);
      check(`turn ${i + 1} streaming bertahap`, deltas > 1);
      if (done?.readyForPrd) {
        ready = true;
        break;
      }
    }
    check("model menyatakan siap PRD", ready, "marker [[SIAP_PRD]] tidak muncul setelah 2 turn");
    check("marker tidak bocor ke teks", !lastText.includes("[[SIAP_PRD]]"));

    console.log("\n4. Generate PRD (SSE)");
    const t0 = Date.now();
    const genRes = await api(`/api/projects/${projectId}/generate`, { method: "POST", body: JSON.stringify({}) });
    check("generate → 200", genRes.status === 200, `status ${genRes.status}`);
    let lastDeltaAt = 0;
    let maxGap = 0;
    let pings = 0;
    let gapStart = 0;
    const genEvents = await readSse(genRes, (event) => {
      if (event.type === "ping") {
        pings += 1;
        const gap = event.__t - gapStart;
        if (gap > maxGap) maxGap = gap;
        gapStart = event.__t;
        return;
      }
      if (event.type === "delta") {
        if (lastDeltaAt === 0) gapStart = 0;
        const gap = event.__t - gapStart;
        if (gap > maxGap) maxGap = gap;
        gapStart = event.__t;
        lastDeltaAt = event.__t;
      }
    });
    const prdText = genEvents.filter((e) => e.type === "delta").map((e) => e.text).join("");
    const genDone = genEvents.find((e) => e.type === "done");
    console.log(
      `   ${prdText.length} karakter dalam ${((Date.now() - t0) / 1000).toFixed(1)}s, tokens ${JSON.stringify(
        genDone?.usage ?? {},
      )}, ping=${pings}, jeda-terpanjang=${maxGap.toFixed(1)}s`,
    );
    check("PRD terisi substansial", prdText.length > 1200, `${prdText.length} karakter`);

    const sections = [
      "Ringkasan Produk",
      "Latar Belakang",
      "Tujuan",
      "Target Pengguna",
      "Ruang Lingkup",
      "Fitur Utama",
      "User Flow",
      "Non-Fungsional",
      "Tech Stack",
      "Kriteria Selesai",
      "Task Breakdown",
      "Pertanyaan Terbuka",
    ];
    const missing = sections.filter((s) => !new RegExp(s, "i").test(prdText));
    check("memuat 12 bagian PRD", missing.length === 0, `belum ada: ${missing.join(", ")}`);
    check("PRD tersimpan di event done", typeof genDone?.prd?.content === "string" && genDone.prd.content.length > 1200);
    check("kuota berkurang (3 → 2)", genDone?.quota?.used === 1 && genDone?.quota?.remaining === 2, JSON.stringify(genDone?.quota));

    console.log("\n5. Task breakdown & export");
    const detail = await json(await api(`/api/projects/${projectId}`));
    check("status project prd_ready", detail.project?.status === "prd_ready", detail.project?.status);
    console.log(`   judul project: "${detail.project?.title}"`);

    const tasksJson = await json(await api(`/api/projects/${projectId}/export?format=tasks-json`));
    const tasks = tasksJson.tasks ?? [];
    console.log(`   ${tasks.length} task terparsing`);
    for (const t of tasks.slice(0, 5)) {
      console.log(`     ${t.id} [${t.complexity}] ${t.title} | files: ${(t.files ?? []).join(", ") || "-"} | depends: ${(t.depends ?? []).join(", ") || "-"}`);
    }
    check("task breakdown terparsing (≥ 6 task)", tasks.length >= 6, `${tasks.length} task`);
    check("task punya id & judul", tasks.every((t) => t.id && t.title));

    const md = await (await api(`/api/projects/${projectId}/export?format=markdown`)).text();
    check("export markdown berisi PRD", md.includes("Ringkasan Produk"));

    console.log("\n--- cuplikan PRD ---");
    console.log(prdText.slice(0, 900));
    console.log("\n--- akhir cuplikan ---");
    void chatUsage;
  } finally {
    server.kill();
    await new Promise((r) => setTimeout(r, 500));
    if (failures > 0) {
      console.error("\n--- log server ---");
      console.error(log.join("").slice(-3000));
    }
  }

  console.log(failures === 0 ? "\nSEMUA OK" : `\n${failures} GAGAL`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
