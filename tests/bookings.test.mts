import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "myprd-booking-"));
process.env.DATABASE_PATH = path.join(tmp, "test.db");
process.env.APP_SECRET = "test-secret-untuk-unit-test-1234567890";

const { CONSULT_PRODUCT } = await import("../lib/billing.ts");
const { isAdminEmail } = await import("../lib/env.ts");
const { getDb } = await import("../lib/db.ts");
const {
  cancelBooking,
  completeBooking,
  confirmBookingPayment,
  createBooking,
  createOrder,
  getBooking,
  linkBookingOrder,
  listAllBookings,
  listBookings,
  markOrderPaid,
} = await import("../lib/repo.ts");

let userSeq = 0;
function makeUser(email: string): string {
  userSeq += 1;
  const id = `usr_bkg${userSeq}`;
  getDb()
    .prepare("INSERT INTO users (id, email, name, password_hash, plan, created_at) VALUES (?, ?, ?, ?, ?, ?)")
    .run(id, email, email.split("@")[0], "hash-dummy", "free", Date.now());
  return id;
}

function userPlan(id: string): string {
  const row = getDb().prepare("SELECT plan FROM users WHERE id = ?").get(id) as { plan: string } | undefined;
  return row?.plan ?? "";
}

describe("CONSULT_PRODUCT", () => {
  it("produk sekali bayar dengan id & harga wajar", () => {
    assert.equal(CONSULT_PRODUCT.id, "consult-60");
    assert.ok(CONSULT_PRODUCT.priceIdr > 0);
    assert.match(CONSULT_PRODUCT.name, /60 menit/);
  });
});

describe("booking lifecycle", () => {
  it("buat → pending_payment, ter-scope per user", () => {
    const userId = makeUser("konsul@example.com");
    const otherId = makeUser("konsul-lain@example.com");
    const booking = createBooking({ userId, topic: "Review PRD kasir", contact: "0812", preferredDate: "Sabtu" });
    assert.ok(booking.id.startsWith("bkg_"));
    assert.equal(booking.status, "pending_payment");
    assert.equal(getBooking(userId, booking.id)?.topic, "Review PRD kasir");
    assert.equal(getBooking(otherId, booking.id), null);
    assert.equal(listBookings(userId).length, 1);
    assert.equal(listBookings(otherId).length, 0);
  });

  it("bayar order konsultasi → booking scheduled, paket user TETAP", () => {
    const userId = makeUser("bayar@example.com");
    const booking = createBooking({ userId, topic: "Arahan stack", contact: "", preferredDate: "" });
    const order = createOrder({ userId, plan: CONSULT_PRODUCT.id, amountIdr: CONSULT_PRODUCT.priceIdr, provider: "mock" });
    linkBookingOrder(booking.id, order.id);
    const result = confirmBookingPayment(order.id);
    assert.ok(result);
    assert.equal(result.order.status, "paid");
    assert.equal(getBooking(userId, booking.id)?.status, "scheduled");
    assert.equal(userPlan(userId), "free");
    // Idempoten
    const again = confirmBookingPayment(order.id);
    assert.ok(again);
    assert.equal(again.alreadyPaid, true);
    assert.equal(getBooking(userId, booking.id)?.status, "scheduled");
  });

  it("order langganan tetap meng-upgrade paket (guard tidak merusak billing lama)", () => {
    const userId = makeUser("tetap-pro@example.com");
    const order = createOrder({ userId, plan: "pro", amountIdr: 149000, provider: "mock" });
    markOrderPaid(order.id);
    assert.equal(userPlan(userId), "pro");
  });

  it("cancel hanya dari pending_payment", () => {
    const userId = makeUser("batal@example.com");
    const pending = createBooking({ userId, topic: "Mau dibatalkan", contact: "", preferredDate: "" });
    assert.equal(cancelBooking(userId, pending.id)?.status, "cancelled");
    const scheduled = createBooking({ userId, topic: "Sudah terjadwal", contact: "", preferredDate: "" });
    const order = createOrder({ userId, plan: CONSULT_PRODUCT.id, amountIdr: CONSULT_PRODUCT.priceIdr, provider: "mock" });
    linkBookingOrder(scheduled.id, order.id);
    confirmBookingPayment(order.id);
    assert.equal(cancelBooking(userId, scheduled.id)?.status, "scheduled");
    assert.equal(cancelBooking(userId, "bkg_tidakada"), null);
  });
});

describe("mentor/admin", () => {
  it("isAdminEmail membaca ADMIN_EMAILS (koma, case-insensitive)", () => {
    process.env.ADMIN_EMAILS = " Mentor@Example.com , lain@example.com ";
    assert.equal(isAdminEmail("mentor@example.com"), true);
    assert.equal(isAdminEmail("LAIN@EXAMPLE.COM"), true);
    assert.equal(isAdminEmail("user@example.com"), false);
    delete process.env.ADMIN_EMAILS;
    assert.equal(isAdminEmail("mentor@example.com"), false);
  });

  it("completeBooking hanya dari scheduled", () => {
    const userId = makeUser("selesai@example.com");
    const pending = createBooking({ userId, topic: "Belum bayar", contact: "", preferredDate: "" });
    assert.equal(completeBooking(pending.id), null);
    const scheduled = createBooking({ userId, topic: "Sudah sesi", contact: "", preferredDate: "" });
    const order = createOrder({ userId, plan: CONSULT_PRODUCT.id, amountIdr: CONSULT_PRODUCT.priceIdr, provider: "mock" });
    linkBookingOrder(scheduled.id, order.id);
    confirmBookingPayment(order.id);
    assert.equal(completeBooking(scheduled.id)?.status, "done");
    assert.equal(completeBooking(scheduled.id), null);
    assert.equal(completeBooking("bkg_tidakada"), null);
  });

  it("listAllBookings memuat email pemilik", () => {
    const userId = makeUser("semua@example.com");
    createBooking({ userId, topic: "Topik admin", contact: "", preferredDate: "" });
    const found = listAllBookings().find((b) => b.topic === "Topik admin");
    assert.ok(found);
    assert.equal(found.userEmail, "semua@example.com");
  });
});
