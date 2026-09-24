import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "myprd-billing-"));
process.env.DATABASE_PATH = path.join(tmp, "test.db");
process.env.APP_SECRET = "test-secret-untuk-unit-test-1234567890";
delete process.env.BILLING_PROVIDER;
delete process.env.MIDTRANS_SERVER_KEY;

const {
  BillingError,
  billingProvider,
  checkoutPlan,
  mapMidtransStatus,
  verifyMidtransSignature,
} = await import("../lib/billing.ts");
const { getDb } = await import("../lib/db.ts");

let userSeq = 0;
/** Buat user via SQL langsung (auth.ts tak bisa diimpor: menarik next/headers). */
function makeUser(email: string): string {
  userSeq += 1;
  const id = `usr_bill${userSeq}`;
  getDb()
    .prepare("INSERT INTO users (id, email, name, password_hash, plan, created_at) VALUES (?, ?, ?, ?, ?, ?)")
    .run(id, email, email.split("@")[0], "hash-dummy", "free", Date.now());
  return id;
}

function userPlan(id: string): string {
  const row = getDb().prepare("SELECT plan FROM users WHERE id = ?").get(id) as { plan: string } | undefined;
  return row?.plan ?? "";
}
const {
  createOrder,
  getOrder,
  getOrderById,
  listOrders,
  markOrderPaid,
  setOrderStatus,
} = await import("../lib/repo.ts");

describe("billing provider", () => {
  it("default mock tanpa merchant key", () => {
    assert.equal(billingProvider(), "mock");
  });

  it("midtrans kalau server key diisi, override via BILLING_PROVIDER", () => {
    process.env.MIDTRANS_SERVER_KEY = "test-server-key-123";
    assert.equal(billingProvider(), "midtrans");
    process.env.BILLING_PROVIDER = "mock";
    assert.equal(billingProvider(), "mock");
    delete process.env.BILLING_PROVIDER;
    assert.equal(billingProvider(), "midtrans");
  });
});

describe("checkoutPlan", () => {
  it("menerima starter & pro", () => {
    assert.equal(checkoutPlan("starter").priceIdr, 49000);
    assert.equal(checkoutPlan("pro").priceIdr, 149000);
  });

  it("menolak free & paket asing dengan BillingError 400", () => {
    for (const bad of ["free", "enterprise", ""]) {
      assert.throws(() => checkoutPlan(bad), (e: unknown) => {
        assert.ok(e instanceof BillingError);
        assert.equal(e.status, 400);
        return true;
      }, bad || "(kosong)");
    }
  });
});

describe("verifyMidtransSignature", () => {
  it("tanda tangan valid lolos, yang diubah ditolak", () => {
    const input = { orderId: "ord_abc123", statusCode: "200", grossAmount: "49000.00" };
    const valid = createHash("sha512")
      .update(`${input.orderId}${input.statusCode}${input.grossAmount}test-server-key-123`)
      .digest("hex");
    assert.equal(verifyMidtransSignature({ ...input, signatureKey: valid }), true);
    assert.equal(verifyMidtransSignature({ ...input, signatureKey: valid.replace(/.$/, "0") }), false);
    assert.equal(verifyMidtransSignature({ ...input, grossAmount: "149000.00", signatureKey: valid }), false);
  });
});

describe("mapMidtransStatus", () => {
  it("memetakan semua status umum", () => {
    assert.equal(mapMidtransStatus("capture", "accept"), "paid");
    assert.equal(mapMidtransStatus("capture", "challenge"), "pending");
    assert.equal(mapMidtransStatus("settlement"), "paid");
    assert.equal(mapMidtransStatus("pending"), "pending");
    assert.equal(mapMidtransStatus("deny"), "failed");
    assert.equal(mapMidtransStatus("cancel"), "failed");
    assert.equal(mapMidtransStatus("failure"), "failed");
    assert.equal(mapMidtransStatus("expire"), "expired");
    assert.equal(mapMidtransStatus("aneh"), "failed");
  });
});

describe("order lifecycle", () => {
  it("create → pending → paid meng-upgrade paket user (idempoten)", () => {
    const userId = makeUser("bill@example.com");
    const otherId = makeUser("lain@example.com");
    const order = createOrder({ userId, plan: "starter", amountIdr: 49000, provider: "mock" });
    assert.equal(order.status, "pending");
    assert.ok(order.id.startsWith("ord_"));

    assert.ok(getOrder(userId, order.id));
    assert.equal(getOrder(otherId, order.id), null);
    assert.ok(getOrderById(order.id));

    const first = markOrderPaid(order.id);
    assert.ok(first);
    assert.equal(first.alreadyPaid, false);
    assert.equal(first.order.status, "paid");
    assert.equal(userPlan(userId), "starter");

    const second = markOrderPaid(order.id);
    assert.ok(second);
    assert.equal(second.alreadyPaid, true);

    assert.equal(listOrders(userId).length, 1);
    assert.equal(listOrders(otherId).length, 0);
  });

  it("order paid tidak bisa diturunkan statusnya", () => {
    const userId = makeUser("bill2@example.com");
    const order = createOrder({ userId, plan: "pro", amountIdr: 149000, provider: "mock" });
    markOrderPaid(order.id);
    const after = setOrderStatus(order.id, "failed");
    assert.equal(after?.status, "paid");
    assert.equal(userPlan(userId), "pro");
  });

  it("order pending bisa gagal/kedaluwarsa", () => {
    const userId = makeUser("bill3@example.com");
    const gagal = createOrder({ userId, plan: "starter", amountIdr: 49000, provider: "mock" });
    assert.equal(setOrderStatus(gagal.id, "failed")?.status, "failed");
    const kadaluarsa = createOrder({ userId, plan: "starter", amountIdr: 49000, provider: "mock" });
    assert.equal(setOrderStatus(kadaluarsa.id, "expired")?.status, "expired");
    assert.equal(userPlan(userId), "free");
  });
});
