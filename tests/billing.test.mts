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
// Shell dev/proses bisa saja sudah punya key Mayar; test harus menentukan sendiri.
delete process.env.MAYAR_API_KEY;
delete process.env.MAYAR_IS_PRODUCTION;

const {
  BillingError,
  billingProvider,
  checkoutPlan,
  createMayarPaymentRequest,
  mayarApiBase,
  mayarPaymentRequest,
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
    delete process.env.BILLING_PROVIDER;
    delete process.env.MIDTRANS_SERVER_KEY;
    delete process.env.MAYAR_API_KEY;
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

  it("mayar hanya aktif kalau dipilih eksplisit via env", () => {
    delete process.env.MIDTRANS_SERVER_KEY;
    delete process.env.BILLING_PROVIDER;
    process.env.MAYAR_API_KEY = "mayar-test-key";
    // Key Mayar yang "menyala" tidak boleh otomatis mengaktifkan pembayaran.
    assert.equal(billingProvider(), "mock");
    process.env.BILLING_PROVIDER = "mayar";
    assert.equal(billingProvider(), "mayar");
    process.env.MIDTRANS_SERVER_KEY = "test-server-key-123";
    assert.equal(billingProvider(), "mayar");
    delete process.env.BILLING_PROVIDER;
    assert.equal(billingProvider(), "midtrans");
    delete process.env.MIDTRANS_SERVER_KEY;
    delete process.env.MAYAR_API_KEY;
    assert.equal(billingProvider(), "mock");
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
    // Server key diset di sini supaya test ini tidak bergantung urutan test lain.
    process.env.MIDTRANS_SERVER_KEY = "test-server-key-123";
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

/** Ganti globalThis.fetch dengan urutan respons tetap; log error dibungkam biar output test bersih. */
function stubFetch(responses: Array<{ status?: number; body?: unknown }>) {
  const originalFetch = globalThis.fetch;
  const originalError = console.error;
  const calls: Array<{ url: string; init: RequestInit | undefined }> = [];
  let index = 0;
  console.error = () => {};
  globalThis.fetch = (async (input: unknown, init?: RequestInit) => {
    calls.push({ url: String(input), init });
    const spec = responses[Math.min(index++, responses.length - 1)]!;
    return new Response(JSON.stringify(spec.body ?? {}), { status: spec.status ?? 200 });
  }) as typeof fetch;
  return {
    calls,
    restore() {
      globalThis.fetch = originalFetch;
      console.error = originalError;
    },
  };
}

function sentBody(call: { init: RequestInit | undefined }): Record<string, unknown> {
  return JSON.parse(String(call.init?.body ?? "{}"));
}

async function withStub(
  responses: Array<{ status?: number; body?: unknown }>,
  run: (calls: Array<{ url: string; init: RequestInit | undefined }>) => Promise<void>,
) {
  const stub = stubFetch(responses);
  try {
    await run(stub.calls);
  } finally {
    stub.restore();
  }
}

const MAYAR_ORDER = {
  orderId: "ord_mayar1",
  amountIdr: 49000,
  description: "MyPRD Starter",
  customerEmail: "a@b.com",
  customerName: "Budi",
};

describe("mayar payment request", () => {
  it("host sandbox vs produksi mengikuti MAYAR_IS_PRODUCTION", () => {
    delete process.env.MAYAR_IS_PRODUCTION;
    assert.equal(mayarApiBase(), "https://api.mayar.io/hl/v2");
    process.env.MAYAR_IS_PRODUCTION = "true";
    assert.equal(mayarApiBase(), "https://api.mayar.id/hl/v2");
    delete process.env.MAYAR_IS_PRODUCTION;
  });

  it("tanpa API key → BillingError 503 tanpa memanggil jaringan", async () => {
    delete process.env.MAYAR_API_KEY;
    await assert.rejects(createMayarPaymentRequest(MAYAR_ORDER), (e: unknown) => {
      assert.ok(e instanceof BillingError);
      assert.equal(e.status, 503);
      return true;
    });
  });

  it("kirim extraData order, header Bearer, dan return link", async () => {
    process.env.MAYAR_API_KEY = "mayar-test-key";
    await withStub(
      [{ body: { statusCode: 200, data: { id: "pay_1", transactionId: "trx_1", link: "https://mayar.id/pay/abc" } } }],
      async (calls) => {
        const result = await createMayarPaymentRequest({ ...MAYAR_ORDER, redirectUrl: "https://myprd.id/billing" });
        assert.equal(result.id, "pay_1");
        assert.equal(result.link, "https://mayar.id/pay/abc");
        assert.equal(calls.length, 1);
        assert.equal(calls[0]!.url, "https://api.mayar.io/hl/v2/payments/create");
        assert.equal(calls[0]!.init?.method, "POST");
        const headers = calls[0]!.init?.headers as Record<string, string>;
        assert.equal(headers.Authorization, "Bearer mayar-test-key");
        const body = sentBody(calls[0]!);
        assert.equal(body.amount, 49000);
        assert.equal(body.email, "a@b.com");
        assert.equal(body.redirectUrl, "https://myprd.id/billing");
        // Kunci korelasi webhook — harus persis nama yang dibaca handleMayar().
        assert.equal((body.extraData as Record<string, string>).myprdOrderId, "ord_mayar1");
      },
    );
  });

  it("statusCode di body tetap dianggap gagal walau HTTP 200", async () => {
    process.env.MAYAR_API_KEY = "mayar-test-key";
    await withStub([{ status: 200, body: { statusCode: 400, messages: "amount is invalid" } }], async () => {
      await assert.rejects(createMayarPaymentRequest(MAYAR_ORDER), (e: unknown) => {
        assert.ok(e instanceof BillingError);
        assert.equal(e.status, 502);
        return true;
      });
    });
  });

  it("redirectUrl ditolak Mayar → ulangi tanpa redirectUrl, lalu sukses", async () => {
    process.env.MAYAR_API_KEY = "mayar-test-key";
    await withStub(
      [
        { status: 400, body: { statusCode: 400, messages: "redirectUrl is not supported on payment requests" } },
        { body: { statusCode: 200, data: { id: "pay_2", link: "https://mayar.id/pay/def" } } },
      ],
      async (calls) => {
        const result = await createMayarPaymentRequest({ ...MAYAR_ORDER, redirectUrl: "https://myprd.id/billing" });
        assert.equal(result.link, "https://mayar.id/pay/def");
        assert.equal(calls.length, 2);
        assert.equal(sentBody(calls[0]!).redirectUrl, "https://myprd.id/billing");
        assert.equal("redirectUrl" in sentBody(calls[1]!), false);
      },
    );
  });

  it("429 diterjemahkan jadi pesan tunggu, dan pesan gateway tidak bocor ke user", async () => {
    process.env.MAYAR_API_KEY = "mayar-test-key";
    await withStub([{ status: 429, body: { statusCode: 429, messages: "Duplicate request detected." } }], async () => {
      await assert.rejects(createMayarPaymentRequest(MAYAR_ORDER), (e: unknown) => {
        assert.ok(e instanceof BillingError);
        assert.equal(e.status, 429);
        assert.ok(!/Duplicate request/.test(e.message), e.message);
        return true;
      });
    });
  });

  it("respons 200 tanpa link → 502", async () => {
    process.env.MAYAR_API_KEY = "mayar-test-key";
    await withStub([{ body: { statusCode: 200, data: { id: "pay_3" } } }], async () => {
      await assert.rejects(createMayarPaymentRequest(MAYAR_ORDER), (e: unknown) => {
        assert.ok(e instanceof BillingError);
        assert.equal(e.status, 502);
        return true;
      });
    });
  });

  it("jaringan gagal → 502", async () => {
    process.env.MAYAR_API_KEY = "mayar-test-key";
    const originalFetch = globalThis.fetch;
    const originalError = console.error;
    console.error = () => {};
    globalThis.fetch = (async () => {
      throw new Error("ECONNREFUSED");
    }) as typeof fetch;
    try {
      await assert.rejects(createMayarPaymentRequest(MAYAR_ORDER), (e: unknown) => {
        assert.ok(e instanceof BillingError);
        assert.equal(e.status, 502);
        return true;
      });
    } finally {
      globalThis.fetch = originalFetch;
      console.error = originalError;
    }
  });
});

describe("mayar status requery", () => {
  it("membaca status paid/unpaid/closed", async () => {
    process.env.MAYAR_API_KEY = "mayar-test-key";
    for (const status of ["paid", "unpaid", "closed"] as const) {
      await withStub([{ body: { statusCode: 200, data: { status, amount: 49000 } } }], async (calls) => {
        const state = await mayarPaymentRequest("pay_1");
        assert.equal(state.status, status);
        assert.equal(state.amount, 49000);
        assert.equal(calls[0]!.url, "https://api.mayar.io/hl/v2/payments/pay_1");
        const headers = calls[0]!.init?.headers as Record<string, string>;
        assert.equal(headers.Authorization, "Bearer mayar-test-key");
      });
    }
  });

  it("link pembayaran diambil dari linkPayment lalu linkUrl, default string kosong", async () => {
    process.env.MAYAR_API_KEY = "mayar-test-key";
    await withStub(
      [{ body: { statusCode: 200, data: { status: "unpaid", linkPayment: "https://bayarki.co/x" } } }],
      async () => {
        assert.equal((await mayarPaymentRequest("pay_1")).link, "https://bayarki.co/x");
      },
    );
    await withStub([{ body: { statusCode: 200, data: { status: "unpaid", linkUrl: "https://bayarki.co/y" } } }], async () => {
      assert.equal((await mayarPaymentRequest("pay_1")).link, "https://bayarki.co/y");
    });
    await withStub([{ body: { statusCode: 200, data: { status: "unpaid" } } }], async () => {
      assert.equal((await mayarPaymentRequest("pay_1")).link, "");
      assert.equal((await mayarPaymentRequest("pay_1")).amount, 0);
    });
  });

  it("status asing dan HTTP error → 502", async () => {
    process.env.MAYAR_API_KEY = "mayar-test-key";
    await withStub([{ body: { statusCode: 200, data: { status: "WEIRD" } } }], async () => {
      await assert.rejects(mayarPaymentRequest("pay_1"), (e: unknown) => {
        assert.ok(e instanceof BillingError);
        assert.equal(e.status, 502);
        return true;
      });
    });
    await withStub([{ status: 404, body: { statusCode: 404 } }], async () => {
      await assert.rejects(mayarPaymentRequest("pay_missing"), (e: unknown) => {
        assert.ok(e instanceof BillingError);
        assert.equal(e.status, 502);
        return true;
      });
    });
  });
});
