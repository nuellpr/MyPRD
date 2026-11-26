/** Kirim email transaksional lewat Resend REST API (tanpa dependency baru). */
export async function sendEmail({ to, subject, html }: { to: string; subject: string; html: string }): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.log(`[dev] Email "${subject}" ke ${to} tidak dikirim (RESEND_API_KEY belum diset).`);
    return;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM || "MyPRD <onboarding@resend.dev>",
      to,
      subject,
      html,
    }),
  });
  if (!res.ok) {
    const detail = await res.text();
    console.error("[email] Resend gagal:", res.status, detail);
    throw new Error(`Gagal mengirim email (${res.status}).`);
  }
}
