import assert from "node:assert/strict";
import test from "node:test";

const {
  buildAdminQrisConfirmEmail,
  buildOrderCreatedEmail,
  buildPaymentRejectedEmail,
  buildPaymentSubmittedEmail,
  buildPaymentSuccessEmail,
  escapeHtml,
  sendOrderCreatedEmail,
} = await import("../lib/billing-email.ts");

test("escapeHtml menetralkan karakter berbahaya agar aman di template HTML", () => {
  assert.equal(
    escapeHtml(`<script>alert("xss")</script> & 'ok'`),
    "&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt; &amp; &#39;ok&#39;",
  );
});

test("buildOrderCreatedEmail menyertakan rincian QRIS, kode unik, dan nama merchant", () => {
  const { subject, html } = buildOrderCreatedEmail({
    to: "budi@example.com",
    userName: "Budi <Admin>",
    orderId: "ord_123",
    planId: "starter",
    amountIdr: 49321,
    baseAmountIdr: 49000,
    uniqueCode: 321,
    provider: "qris",
    merchantName: "Mas N, Digital & Kreatif",
    nmid: "ID1026494026150",
    billingUrl: "https://myprd.test/billing",
  });
  assert.match(subject, /Starter/);
  assert.match(subject, /49\.321/);
  assert.ok(html.includes("Budi &lt;Admin&gt;"));
  assert.ok(html.includes("Pembayaran via QRIS"));
  assert.ok(html.includes("Mas N, Digital &amp; Kreatif"));
  assert.ok(html.includes("ID1026494026150"));
  assert.ok(html.includes("ord_123"));
});

test("buildPaymentSubmittedEmail & buildAdminQrisConfirmEmail mengamankan catatan pengirim", () => {
  const buyerMail = buildPaymentSubmittedEmail({
    to: "budi@example.com",
    userName: "Budi",
    orderId: "ord_q1",
    planId: "pro",
    amountIdr: 149210,
    note: "GoPay <b>Budi</b>",
    billingUrl: "https://myprd.test/billing",
  });
  assert.match(buyerMail.subject, /ord_q1/);
  assert.ok(buyerMail.html.includes("GoPay &lt;b&gt;Budi&lt;/b&gt;"));

  const adminMail = buildAdminQrisConfirmEmail({
    to: "admin@example.com",
    buyerName: "Budi",
    buyerEmail: "budi@example.com",
    orderId: "ord_q1",
    planId: "pro",
    amountIdr: 149210,
    note: "ShopeePay <script>x</script>",
    billingUrl: "https://myprd.test/billing",
  });
  assert.match(adminMail.subject, /149\.210/);
  assert.ok(adminMail.html.includes("ShopeePay &lt;script&gt;x&lt;/script&gt;"));
});

test("buildPaymentSuccessEmail & buildPaymentRejectedEmail memuat status paket dan CTA", () => {
  const okMail = buildPaymentSuccessEmail({
    to: "budi@example.com",
    userName: "Budi",
    orderId: "ord_ok",
    planId: "pro",
    amountIdr: 149333,
    provider: "qris",
    dashboardUrl: "https://myprd.test/dashboard",
  });
  assert.match(okMail.subject, /Pro Sudah Aktif/);
  assert.ok(okMail.html.includes("PRD tak terbatas/bulan"));
  assert.ok(okMail.html.includes("Lunas"));

  const failMail = buildPaymentRejectedEmail({
    to: "budi@example.com",
    userName: "Budi",
    orderId: "ord_fail",
    planId: "starter",
    amountIdr: 49111,
    billingUrl: "https://myprd.test/billing",
  });
  assert.match(failMail.subject, /ord_fail/);
  assert.ok(failMail.html.includes("Kembali ke Billing"));
});

test("sendOrderCreatedEmail mengembalikan false tanpa error saat RESEND_API_KEY kosong dan mengirim via Resend saat diisi", async () => {
  const origKey = process.env.RESEND_API_KEY;
  const origFrom = process.env.EMAIL_FROM;
  const origFetch = globalThis.fetch;
  try {
    delete process.env.RESEND_API_KEY;
    const devResult = await sendOrderCreatedEmail({
      to: "budi@example.com",
      userName: "Budi",
      orderId: "ord_dev",
      planId: "starter",
      amountIdr: 49222,
      provider: "qris",
      billingUrl: "https://myprd.test/billing",
    });
    assert.equal(devResult, false);

    let capturedAuth = "";
    let capturedBody = "";
    process.env.RESEND_API_KEY = "re_test_key_123";
    process.env.EMAIL_FROM = "MyPRD <billing@myprd.test>";
    globalThis.fetch = (async (_url: unknown, init?: RequestInit) => {
      capturedAuth = String((init?.headers as Record<string, string>)?.Authorization ?? "");
      capturedBody = String(init?.body ?? "");
      return new Response(JSON.stringify({ id: "em_1" }), { status: 200 });
    }) as typeof fetch;

    const sentResult = await sendOrderCreatedEmail({
      to: "budi@example.com",
      userName: "Budi",
      orderId: "ord_live",
      planId: "starter",
      amountIdr: 49222,
      provider: "qris",
      billingUrl: "https://myprd.test/billing",
    });
    assert.equal(sentResult, true);
    assert.equal(capturedAuth, "Bearer re_test_key_123");
    assert.ok(capturedBody.includes("budi@example.com"));
    assert.ok(capturedBody.includes("billing@myprd.test"));
  } finally {
    globalThis.fetch = origFetch;
    if (origKey === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = origKey;
    if (origFrom === undefined) delete process.env.EMAIL_FROM;
    else process.env.EMAIL_FROM = origFrom;
  }
});
