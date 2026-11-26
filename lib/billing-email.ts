import { sendEmail } from "./email.ts";
import { formatIdr } from "./format.ts";
import { getPlan } from "./plans.ts";

export function escapeHtml(input: string): string {
  return input
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function methodLabel(provider: string): string {
  switch (provider) {
    case "qris":
      return "Pembayaran via QRIS";
    case "midtrans":
      return "Midtrans (QRIS / e-Wallet / Bank)";
    case "mayar":
      return "Mayar";
    default:
      return "Simulasi Lokal";
  }
}

function wrapEmailLayout(title: string, badge: string, bodyHtml: string, cta?: { label: string; url: string }): string {
  const safeTitle = escapeHtml(title);
  const safeBadge = escapeHtml(badge);
  const ctaHtml = cta
    ? `<p style="margin:24px 0 8px"><a href="${escapeHtml(cta.url)}" style="display:inline-block;background:#35d6ff;color:#060912;text-decoration:none;font-weight:700;font-size:14px;padding:11px 20px;border-radius:10px">${escapeHtml(cta.label)}</a></p>`
    : "";
  return `<!doctype html>
<html lang="id">
<body style="margin:0;padding:24px;background:#060912;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#e2e8f0">
  <div style="max-width:560px;margin:0 auto;background:#0b1022;border:1px solid #1e293b;border-radius:16px;overflow:hidden">
    <div style="background:linear-gradient(135deg,#0f1f47,#162a5c);padding:20px 24px;border-bottom:1px solid #1e293b">
      <div style="font-size:12px;font-weight:700;letter-spacing:0.08em;color:#7fe3ff;text-transform:uppercase">MyPRD · ${safeBadge}</div>
      <h1 style="margin:6px 0 0;font-size:18px;line-height:1.35;color:#ffffff">${safeTitle}</h1>
    </div>
    <div style="padding:22px 24px;font-size:14px;line-height:1.6;color:#cbd5e1">
      ${bodyHtml}
      ${ctaHtml}
    </div>
    <div style="padding:14px 24px;border-top:1px solid #1e293b;font-size:12px;color:#64748b">
      Email otomatis dari MyPRD — Platform PRD &amp; Task Breakdown untuk AI Coding Agent.
    </div>
  </div>
</body>
</html>`;
}

async function trySend(to: string, subject: string, html: string): Promise<boolean> {
  if (!to.trim()) return false;
  if (!process.env.RESEND_API_KEY) {
    await sendEmail({ to, subject, html });
    return false;
  }
  try {
    await sendEmail({ to, subject, html });
    return true;
  } catch (error) {
    console.error("[billing-email] Gagal kirim:", subject, error);
    return false;
  }
}

export interface OrderCreatedEmailInput {
  to: string;
  userName: string;
  orderId: string;
  planId: string;
  amountIdr: number;
  baseAmountIdr?: number;
  uniqueCode?: number;
  provider: string;
  merchantName?: string;
  nmid?: string;
  billingUrl: string;
}

export function buildOrderCreatedEmail(input: OrderCreatedEmailInput): { subject: string; html: string } {
  const plan = getPlan(input.planId);
  const uniqueCode = input.uniqueCode ?? 0;
  const baseAmount = input.baseAmountIdr ?? input.amountIdr;
  const subject = `[MyPRD] Tagihan Pembayaran Paket ${plan.name} — ${formatIdr(input.amountIdr)}`;
  const body = `
    <p style="margin-top:0">Halo <strong>${escapeHtml(input.userName || "Builder")}</strong>,</p>
    <p>Order langganan paket <strong>${escapeHtml(plan.name)}</strong> kamu telah dibuat. Berikut rincian tagihannya:</p>
    <table style="width:100%;border-collapse:collapse;background:#060912;border:1px solid #1e293b;border-radius:10px;margin:14px 0">
      <tr><td style="padding:8px 12px;color:#94a3b8">Order ID</td><td style="padding:8px 12px;text-align:right;color:#fff;font-family:monospace">${escapeHtml(input.orderId)}</td></tr>
      <tr><td style="padding:8px 12px;color:#94a3b8">Metode</td><td style="padding:8px 12px;text-align:right;color:#fff">${escapeHtml(methodLabel(input.provider))}</td></tr>
      <tr><td style="padding:8px 12px;color:#94a3b8">Harga paket</td><td style="padding:8px 12px;text-align:right;color:#fff">${escapeHtml(formatIdr(baseAmount))}</td></tr>
      ${uniqueCode > 0 ? `<tr><td style="padding:8px 12px;color:#94a3b8">Kode unik QRIS</td><td style="padding:8px 12px;text-align:right;color:#7fe3ff">+${escapeHtml(formatIdr(uniqueCode))}</td></tr>` : ""}
      <tr style="border-top:1px solid #1e293b"><td style="padding:10px 12px;font-weight:700;color:#fff">Total transfer</td><td style="padding:10px 12px;text-align:right;font-weight:700;color:#35d6ff;font-size:16px">${escapeHtml(formatIdr(input.amountIdr))}</td></tr>
    </table>
    ${input.merchantName ? `<p style="font-size:12px;color:#94a3b8">Merchant QRIS: <strong style="color:#e2e8f0">${escapeHtml(input.merchantName)}</strong>${input.nmid ? ` (NMID ${escapeHtml(input.nmid)})` : ""}. Scan lewat GoPay, ShopeePay, DANA, OVO, LinkAja, atau m-Banking.</p>` : ""}
  `;
  return {
    subject,
    html: wrapEmailLayout(`Tagihan Paket ${plan.name}`, "Tagihan Order", body, {
      label: "Buka Halaman Pembayaran",
      url: input.billingUrl,
    }),
  };
}

export function sendOrderCreatedEmail(input: OrderCreatedEmailInput): Promise<boolean> {
  const { subject, html } = buildOrderCreatedEmail(input);
  return trySend(input.to, subject, html);
}

export interface PaymentSubmittedEmailInput {
  to: string;
  userName: string;
  orderId: string;
  planId: string;
  amountIdr: number;
  note?: string;
  billingUrl: string;
}

export function buildPaymentSubmittedEmail(input: PaymentSubmittedEmailInput): { subject: string; html: string } {
  const plan = getPlan(input.planId);
  const subject = `[MyPRD] Konfirmasi Pembayaran QRIS Diterima (${input.orderId})`;
  const body = `
    <p style="margin-top:0">Halo <strong>${escapeHtml(input.userName || "Builder")}</strong>,</p>
    <p>Terima kasih! Konfirmasi pembayaran via QRIS kamu sebesar <strong>${escapeHtml(formatIdr(input.amountIdr))}</strong> untuk paket <strong>${escapeHtml(plan.name)}</strong> (Order <code>${escapeHtml(input.orderId)}</code>) sudah kami terima.</p>
    ${input.note ? `<p>Catatan pengirim: <em>${escapeHtml(input.note)}</em></p>` : ""}
    <p>Admin sedang mencocokkan mutasi pembayaranmu. Kamu akan menerima email lagi segera setelah paket aktif.</p>
  `;
  return {
    subject,
    html: wrapEmailLayout("Konfirmasi Pembayaran Diterima", "Menunggu Verifikasi", body, {
      label: "Cek Status Order",
      url: input.billingUrl,
    }),
  };
}

export function sendPaymentSubmittedEmail(input: PaymentSubmittedEmailInput): Promise<boolean> {
  const { subject, html } = buildPaymentSubmittedEmail(input);
  return trySend(input.to, subject, html);
}

export interface AdminQrisConfirmEmailInput {
  to: string;
  buyerName: string;
  buyerEmail: string;
  orderId: string;
  planId: string;
  amountIdr: number;
  note?: string;
  billingUrl: string;
}

export function buildAdminQrisConfirmEmail(input: AdminQrisConfirmEmailInput): { subject: string; html: string } {
  const plan = getPlan(input.planId);
  const subject = `[MyPRD Admin] Konfirmasi QRIS ${formatIdr(input.amountIdr)} (${plan.name})`;
  const body = `
    <p style="margin-top:0">User <strong>${escapeHtml(input.buyerName || input.buyerEmail)}</strong> (<code>${escapeHtml(input.buyerEmail)}</code>) menandai sudah transfer via QRIS.</p>
    <ul style="padding-left:18px;margin:12px 0">
      <li>Order ID: <code>${escapeHtml(input.orderId)}</code></li>
      <li>Paket: <strong>${escapeHtml(plan.name)}</strong></li>
      <li>Nominal unik: <strong style="color:#35d6ff">${escapeHtml(formatIdr(input.amountIdr))}</strong></li>
      ${input.note ? `<li>Catatan: <em>${escapeHtml(input.note)}</em></li>` : ""}
    </ul>
    <p>Cocokkan nominal di notifikasi GoPay Merchant lalu setujui lewat panel admin di halaman Billing.</p>
  `;
  return {
    subject,
    html: wrapEmailLayout("Verifikasi Pembayaran Masuk", "Admin Billing", body, {
      label: "Buka Panel Admin Billing",
      url: input.billingUrl,
    }),
  };
}

export function sendAdminQrisConfirmEmail(input: AdminQrisConfirmEmailInput): Promise<boolean> {
  const { subject, html } = buildAdminQrisConfirmEmail(input);
  return trySend(input.to, subject, html);
}

export interface PaymentSuccessEmailInput {
  to: string;
  userName: string;
  orderId: string;
  planId: string;
  amountIdr: number;
  provider: string;
  dashboardUrl: string;
}

export function buildPaymentSuccessEmail(input: PaymentSuccessEmailInput): { subject: string; html: string } {
  const plan = getPlan(input.planId);
  const subject = `[MyPRD] Pembayaran Berhasil — Paket ${plan.name} Sudah Aktif`;
  const body = `
    <p style="margin-top:0">Halo <strong>${escapeHtml(input.userName || "Builder")}</strong>,</p>
    <p>Pembayaranmu telah terverifikasi <strong style="color:#34d399">Lunas</strong>! Paket <strong>${escapeHtml(plan.name)}</strong> sekarang aktif di akunmu dengan kuota <strong>${plan.monthlyQuota} generate PRD/bulan</strong>.</p>
    <table style="width:100%;border-collapse:collapse;background:#060912;border:1px solid #1e293b;border-radius:10px;margin:14px 0">
      <tr><td style="padding:8px 12px;color:#94a3b8">Order ID</td><td style="padding:8px 12px;text-align:right;color:#fff;font-family:monospace">${escapeHtml(input.orderId)}</td></tr>
      <tr><td style="padding:8px 12px;color:#94a3b8">Metode</td><td style="padding:8px 12px;text-align:right;color:#fff">${escapeHtml(methodLabel(input.provider))}</td></tr>
      <tr><td style="padding:8px 12px;color:#94a3b8">Status</td><td style="padding:8px 12px;text-align:right;color:#34d399;font-weight:700">Lunas</td></tr>
      <tr><td style="padding:8px 12px;color:#94a3b8">Total dibayar</td><td style="padding:8px 12px;text-align:right;color:#fff;font-weight:700">${escapeHtml(formatIdr(input.amountIdr))}</td></tr>
    </table>
  `;
  return {
    subject,
    html: wrapEmailLayout(`Paket ${plan.name} Aktif`, "Pembayaran Lunas", body, {
      label: "Mulai Buat PRD di Dashboard",
      url: input.dashboardUrl,
    }),
  };
}

export function sendPaymentSuccessEmail(input: PaymentSuccessEmailInput): Promise<boolean> {
  const { subject, html } = buildPaymentSuccessEmail(input);
  return trySend(input.to, subject, html);
}

export interface PaymentRejectedEmailInput {
  to: string;
  userName: string;
  orderId: string;
  planId: string;
  amountIdr: number;
  billingUrl: string;
}

export function buildPaymentRejectedEmail(input: PaymentRejectedEmailInput): { subject: string; html: string } {
  const plan = getPlan(input.planId);
  const subject = `[MyPRD] Pembayaran Order ${input.orderId} Tidak Dapat Diverifikasi`;
  const body = `
    <p style="margin-top:0">Halo <strong>${escapeHtml(input.userName || "Builder")}</strong>,</p>
    <p>Kami belum menemukan mutasi masuk sebesar <strong>${escapeHtml(formatIdr(input.amountIdr))}</strong> untuk Order <code>${escapeHtml(input.orderId)}</code> (paket <strong>${escapeHtml(plan.name)}</strong>), sehingga order ditandai gagal.</p>
    <p>Jika dana sudah terpotong atau ingin mencoba lagi, silakan buat order baru di halaman Billing.</p>
  `;
  return {
    subject,
    html: wrapEmailLayout("Verifikasi Pembayaran Ditolak", "Status Order", body, {
      label: "Kembali ke Billing",
      url: input.billingUrl,
    }),
  };
}

export function sendPaymentRejectedEmail(input: PaymentRejectedEmailInput): Promise<boolean> {
  const { subject, html } = buildPaymentRejectedEmail(input);
  return trySend(input.to, subject, html);
}
