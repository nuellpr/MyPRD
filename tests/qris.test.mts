import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const SAMPLE_STATIC_QRIS =
  "00020101021126610014COM.GO-JEK.WWW01189360091435883948200210G5883948200303UMI51440014ID.CO.QRIS.WWW0215ID10264940261500303UMI5204899953033605802ID5924Mas N, Digital & Kreatif6006KUPANG61058522862070703A016304CAC7";

process.env.APP_SECRET = "test-secret-untuk-qris-1234567890";
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "myprd-qris-"));
process.env.DATABASE_PATH = path.join(tmpDir, "qris.db");

const {
  crc16Ccitt,
  createDynamicQris,
  extractQrisMerchant,
  parseEmvTags,
  renderQrisSvg,
  verifyQrisCrc,
} = await import("../lib/qris.ts");
const { BillingError } = await import("../lib/billing.ts");
const { pickUniqueQrisAmount, createOrder } = await import("../lib/repo.ts");
const { getDb } = await import("../lib/db.ts");

test("verifyQrisCrc memvalidasi CRC asli GoPay Merchant dan menolak payload korup", () => {
  assert.equal(verifyQrisCrc(SAMPLE_STATIC_QRIS), true);
  assert.equal(crc16Ccitt(SAMPLE_STATIC_QRIS.slice(0, -4)), "CAC7");
  assert.equal(verifyQrisCrc(`${SAMPLE_STATIC_QRIS.slice(0, -4)}0000`), false);
});

test("extractQrisMerchant membaca nama merchant, kota, dan NMID", () => {
  const merchant = extractQrisMerchant(SAMPLE_STATIC_QRIS);
  assert.equal(merchant.merchantName, "Mas N, Digital & Kreatif");
  assert.equal(merchant.merchantCity, "KUPANG");
  assert.equal(merchant.nmid, "ID1026494026150");
});

test("createDynamicQris mengubah tag 01 -> 12, menambah nominal tag 54, dan menghitung ulang CRC", () => {
  const dynamic = createDynamicQris(SAMPLE_STATIC_QRIS, 49123);
  assert.equal(verifyQrisCrc(dynamic), true);

  const tags = parseEmvTags(dynamic);
  assert.equal(tags.find((t) => t.tag === "01")?.value, "12");
  assert.equal(tags.find((t) => t.tag === "54")?.value, "49123");
  assert.notEqual(dynamic.slice(-4), "CAC7");
});

test("createDynamicQris menolak payload tidak valid atau nominal di luar batas", () => {
  assert.throws(() => createDynamicQris("bukan-qris", 49000), BillingError);
  assert.throws(() => createDynamicQris(SAMPLE_STATIC_QRIS, 0), BillingError);
  assert.throws(() => createDynamicQris(SAMPLE_STATIC_QRIS, 49000.5), BillingError);
});

test("renderQrisSvg menghasilkan markup SVG valid", async () => {
  const dynamic = createDynamicQris(SAMPLE_STATIC_QRIS, 49123);
  const svg = await renderQrisSvg(dynamic);
  assert.ok(svg.includes("<svg") && svg.includes("</svg>"));
});

test("pickUniqueQrisAmount menghindari benturan nominal order pending", () => {
  const db = getDb();
  const now = Date.now();
  db.prepare("INSERT INTO users (id, email, name, plan, email_verified, created_at) VALUES (?, ?, ?, 'free', 1, ?)").run(
    "usr_qris_1",
    "qris@example.com",
    "QRIS User",
    now,
  );
  const first = pickUniqueQrisAmount(49000);
  assert.ok(first >= 49101 && first <= 49899);
  createOrder({ userId: "usr_qris_1", plan: "starter", amountIdr: first, provider: "qris" });

  const second = pickUniqueQrisAmount(49000);
  assert.ok(second >= 49101 && second <= 49899);
  assert.notEqual(second, first);
});
