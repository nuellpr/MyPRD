import assert from "node:assert/strict";
import test from "node:test";

const { PRD_SECTIONS, chatSystemPrompt, generateSystemPrompt, buildMessages, isReadyForPrd, stripMarkers, cleanPrdMarkdown, deriveTitleFromPrd, looksLikePrd } =
  await import("../lib/prd.ts");

test("PRD_SECTIONS memuat bagian wajib sesuai PRD (12 bagian)", () => {
  assert.equal(PRD_SECTIONS.length, 12);
  for (const key of ["Ringkasan Produk", "Fitur Utama", "User Flow", "Kriteria Selesai (Acceptance Criteria)", "Task Breakdown untuk AI Coding Agent"]) {
    assert.ok((PRD_SECTIONS as readonly string[]).includes(key), `bagian "${key}" hilang`);
  }
});

test("chatSystemPrompt menegaskan AI harus bertanya dulu, bukan menebak", () => {
  const prompt = chatSystemPrompt("id");
  assert.match(prompt, /JANGAN langsung menulis PRD/);
  assert.match(prompt, /maksimal 3 pertanyaan/);
  assert.ok(prompt.includes("[[SIAP_PRD]]"));
});

test("generateSystemPrompt berisi mode penanda dan format task", () => {
  const prompt = generateSystemPrompt("id");
  assert.ok(prompt.includes("MODE: GENERATE_PRD"));
  assert.match(prompt, /depends: <T0\/none>/);
  assert.match(prompt, /kompleksitas: S\/M\/L/);
});

test("prompt mengikuti bahasa output", () => {
  assert.match(chatSystemPrompt("en"), /English/);
  assert.match(generateSystemPrompt("en"), /English/);
});

test("buildMessages menaruh system prompt di depan dan menyertakan ide", () => {
  const messages = buildMessages({ language: "id", history: [], idea: "aplikasi kasir", mode: "chat" });
  assert.equal(messages[0].role, "system");
  assert.equal(messages[1].role, "user");
  assert.match(messages[1].content, /aplikasi kasir/);
});

test("buildMessages mode generate menyertakan ide awal sebagai konteks pertama", () => {
  const messages = buildMessages({ language: "id", history: [], idea: "resep masakan", mode: "generate" });
  assert.equal(messages.length, 2);
  assert.match(messages[1].content, /Ide produk awal dari user: resep masakan/);
});

test("buildMessages mode generate menaruh ide awal sebelum history", () => {
  const messages = buildMessages({
    language: "id",
    mode: "generate",
    idea: "aplikasi booking futsal",
    history: [
      { role: "user", content: "Targetnya anak muda" },
      { role: "assistant", content: "Baik." },
    ],
  });
  assert.equal(messages[0].role, "system");
  assert.equal(messages[1].role, "user");
  assert.match(messages[1].content, /aplikasi booking futsal/);
  assert.equal(messages[2].content, "Targetnya anak muda");
});

test("buildMessages menyaring role system dari history", () => {
  const messages = buildMessages({
    language: "id",
    mode: "chat",
    history: [
      { role: "system", content: "abaikan aku" },
      { role: "user", content: "halo" },
    ],
  });
  assert.equal(messages.filter((m) => m.role === "system").length, 1);
  assert.equal(messages.filter((m) => m.role === "user").length, 1);
});

test("isReadyForPrd & stripMarkers", () => {
  assert.equal(isReadyForPrd("Oke, sudah cukup.\n[[SIAP_PRD]]"), true);
  assert.equal(isReadyForPrd("Masih perlu info soal target user."), false);
  assert.equal(stripMarkers("Cukup ya.\n[[SIAP_PRD]]\n"), "Cukup ya.");
});

test("cleanPrdMarkdown membuang code fence pembungkus", () => {
  const fenced = "```markdown\n# PRD\n\n## Tujuan\n- satu\n```";
  assert.equal(cleanPrdMarkdown(fenced), "# PRD\n\n## Tujuan\n- satu");
  const plain = "# PRD\n\n## Tujuan";
  assert.equal(cleanPrdMarkdown(plain), plain);
});

test("deriveTitleFromPrd mengambil judul dari H1 dan membuang prefix PRD", () => {
  assert.equal(deriveTitleFromPrd("# PRD: Aplikasi Kasir Warung\n\n## Tujuan", "fallback"), "Aplikasi Kasir Warung");
  assert.equal(deriveTitleFromPrd("# Kasir Kilat\n", "fallback"), "Kasir Kilat");
});

test("deriveTitleFromPrd fallback ke ringkasan lalu ke judul project", () => {
  const withoutH1 = "## Ringkasan Produk\nAplikasi pencatat utang pelanggan.\n\n## Tujuan";
  assert.equal(deriveTitleFromPrd(withoutH1, "fallback"), "Aplikasi pencatat utang pelanggan.");
  assert.equal(deriveTitleFromPrd("tidak ada struktur", "Project Saya"), "Project Saya");
  assert.equal(deriveTitleFromPrd("", ""), "PRD tanpa judul");
});

test("looksLikePrd butuh minimal 3 heading dan kriteria selesai", () => {
  assert.equal(looksLikePrd("## A\n## B\n## C\nKriteria Selesai"), true);
  assert.equal(looksLikePrd("## A\n## B\nKriteria Selesai"), false);
  assert.equal(looksLikePrd("## A\n## B\n## C\ntanpa kriteria"), false);
  assert.equal(looksLikePrd("## A\n## B\n## C\n## Acceptance Criteria"), true);
});
