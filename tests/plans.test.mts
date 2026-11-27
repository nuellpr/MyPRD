import assert from "node:assert/strict";
import test from "node:test";

process.env.FREE_MONTHLY_QUOTA = "5";

const { PLANS, getPlan, isPlanUpgrade, evaluateQuota, estimateCostUsd, estimateTokens } = await import("../lib/plans.ts");

test("PLANS punya minimal 3 tier sesuai PRD (free/starter/pro)", () => {
  assert.deepEqual(Object.keys(PLANS).sort(), ["free", "pro", "starter"]);
  assert.equal(PLANS.free.priceIdr, 0);
  assert.equal(PLANS.starter.priceIdr, 49000);
  assert.equal(PLANS.starter.monthlyQuota, 25);
  assert.equal(PLANS.starter.unlimited, false);
  assert.equal(PLANS.pro.priceIdr, 149000);
  assert.equal(PLANS.pro.unlimited, true);
});

test("kuota free tier mengikuti env FREE_MONTHLY_QUOTA", () => {
  assert.equal(PLANS.free.monthlyQuota, 5);
});

test("getPlan fallback ke free untuk plan tak dikenal", () => {
  assert.equal(getPlan("enterprise-ngawur").id, "free");
  assert.equal(getPlan("pro").id, "pro");
});

test("isPlanUpgrade hanya meloloskan paket yang sama atau lebih tinggi", () => {
  assert.equal(isPlanUpgrade("free", "starter"), true);
  assert.equal(isPlanUpgrade("free", "pro"), true);
  assert.equal(isPlanUpgrade("starter", "starter"), true);
  assert.equal(isPlanUpgrade("pro", "pro"), true);
  // Renewal starter oleh user pro tidak boleh menurunkan paket.
  assert.equal(isPlanUpgrade("pro", "starter"), false);
  assert.equal(isPlanUpgrade("starter", "free"), false);
  // Plan tak dikenal dianggap free, jadi tidak menurunkan apa pun yang nyata.
  assert.equal(isPlanUpgrade("pro", "enterprise-ngawur"), false);
  assert.equal(isPlanUpgrade("enterprise-ngawur", "pro"), true);
  // Order produk sekali bayar tidak boleh menyentuh paket.
  assert.equal(isPlanUpgrade("free", "consult-60"), false);
  assert.equal(isPlanUpgrade("starter", "consult-60"), false);
});

test("evaluateQuota menghitung sisa kuota dan resetsAt awal bulan berikutnya", () => {
  const reference = new Date(2026, 0, 15, 10, 0, 0).getTime(); // 15 Jan 2026
  const state = evaluateQuota("free", 2, reference);
  assert.equal(state.used, 2);
  assert.equal(state.limit, 5);
  assert.equal(state.remaining, 3);
  assert.equal(state.unlimited, false);
  assert.equal(state.allowed, true);
  const resets = new Date(state.resetsAt);
  assert.equal(resets.getFullYear(), 2026);
  assert.equal(resets.getMonth(), 1); // Februari
  assert.equal(resets.getDate(), 1);
});

test("evaluateQuota memblokir saat kuota habis dan mengizinkan tak terbatas untuk Pro", () => {
  assert.equal(evaluateQuota("free", 5).allowed, false);
  assert.equal(evaluateQuota("free", 5).remaining, 0);
  assert.equal(evaluateQuota("free", 99).remaining, 0);
  assert.equal(evaluateQuota("starter", 24).allowed, true);
  assert.equal(evaluateQuota("starter", 25).allowed, false);
  const proState = evaluateQuota("pro", 99999);
  assert.equal(proState.unlimited, true);
  assert.equal(proState.allowed, true);
});

test("estimateCostUsd menghitung biaya per 1 juta token", () => {
  // 1 juta token in @ $0.15 + 1 juta token out @ $0.60 = $0.75
  assert.equal(estimateCostUsd(1_000_000, 1_000_000, 0.15, 0.6), 0.75);
  assert.equal(estimateCostUsd(0, 0, 0.15, 0.6), 0);
  assert.ok(Math.abs(estimateCostUsd(2000, 1000, 3, 15) - (0.006 + 0.015)) < 1e-9);
});

test("estimateTokens memakai perkiraan 4 karakter per token", () => {
  assert.equal(estimateTokens(""), 1);
  assert.equal(estimateTokens("abcd"), 1);
  assert.equal(estimateTokens("a".repeat(400)), 100);
  assert.ok(estimateTokens("a".repeat(401)) === 101);
});
