import assert from "node:assert/strict";
import test from "node:test";

process.env.FREE_MONTHLY_QUOTA = "5";

const { PLANS, getPlan, evaluateQuota, estimateCostUsd, estimateTokens } = await import("../lib/plans.ts");

test("PLANS punya minimal 3 tier sesuai PRD (free/starter/pro)", () => {
  assert.deepEqual(Object.keys(PLANS).sort(), ["free", "pro", "starter"]);
  assert.equal(PLANS.free.priceIdr, 0);
  assert.ok(PLANS.starter.priceIdr > 0);
  assert.ok(PLANS.pro.priceIdr > PLANS.starter.priceIdr);
});

test("kuota free tier mengikuti env FREE_MONTHLY_QUOTA", () => {
  assert.equal(PLANS.free.monthlyQuota, 5);
});

test("getPlan fallback ke free untuk plan tak dikenal", () => {
  assert.equal(getPlan("enterprise-ngawur").id, "free");
  assert.equal(getPlan("pro").id, "pro");
});

test("evaluateQuota menghitung sisa kuota dan resetsAt awal bulan berikutnya", () => {
  const reference = new Date(2026, 0, 15, 10, 0, 0).getTime(); // 15 Jan 2026
  const state = evaluateQuota("free", 2, reference);
  assert.equal(state.used, 2);
  assert.equal(state.limit, 5);
  assert.equal(state.remaining, 3);
  assert.equal(state.allowed, true);
  const resets = new Date(state.resetsAt);
  assert.equal(resets.getFullYear(), 2026);
  assert.equal(resets.getMonth(), 1); // Februari
  assert.equal(resets.getDate(), 1);
});

test("evaluateQuota memblokir saat kuota habis / terlampaui", () => {
  assert.equal(evaluateQuota("free", 5).allowed, false);
  assert.equal(evaluateQuota("free", 5).remaining, 0);
  assert.equal(evaluateQuota("free", 99).remaining, 0);
  assert.equal(evaluateQuota("pro", 999).allowed, true);
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
