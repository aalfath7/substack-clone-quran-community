// Kirim email lewat Resend (fetch, tanpa SDK). Tanpa RESEND_API_KEY: hanya dicetak ke log.
// Dipakai dari Next (server action) dan dari consumer queue di worker.ts, jadi tanpa "server-only".

export type EmailMessage = {
  to: string;
  subject: string;
  html: string;
  text: string;
  headers?: Record<string, string>;
};

export type EmailEnv = {
  RESEND_API_KEY?: string;
  EMAIL_FROM?: string;
  APP_URL?: string;
};

export function appUrl(env: EmailEnv) {
  return (env.APP_URL || "http://localhost:3000").replace(/\/+$/, "");
}

export async function sendEmails(env: EmailEnv, messages: EmailMessage[]) {
  if (messages.length === 0) return;
  const from = env.EMAIL_FROM || "Quran Community <noreply@example.com>";

  if (!env.RESEND_API_KEY) {
    for (const m of messages) {
      console.log(`[email:dev] ke=${m.to} subjek="${m.subject}"\n${m.text.slice(0, 600)}`);
    }
    return;
  }

  // Batch API Resend: maksimal 100 email per panggilan.
  for (let i = 0; i < messages.length; i += 100) {
    const chunk = messages.slice(i, i + 100).map((m) => ({
      from,
      to: [m.to],
      subject: m.subject,
      html: m.html,
      text: m.text,
      headers: m.headers,
    }));
    const res = await fetch("https://api.resend.com/emails/batch", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify(chunk),
    });
    if (!res.ok) {
      throw new Error(`Resend gagal (${res.status}): ${(await res.text()).slice(0, 300)}`);
    }
  }
}

/** Kerangka HTML email sederhana yang aman untuk klien email. */
export function emailLayout(opts: { title: string; bodyHtml: string; footerHtml: string }) {
  return `<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${opts.title}</title></head>
<body style="margin:0;background:#fdfcf8;color:#1c1b19;font-family:Georgia,'Times New Roman',serif">
<div style="max-width:600px;margin:0 auto;padding:32px 20px;font-size:17px;line-height:1.7">
${opts.bodyHtml}
<hr style="border:none;border-top:1px solid #e7e4dc;margin:32px 0">
<div style="font-family:Arial,sans-serif;font-size:13px;color:#6b6860">${opts.footerHtml}</div>
</div></body></html>`;
}
