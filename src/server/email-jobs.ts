import "server-only";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getDb } from "@/db";
import { sendEmails, type EmailMessage } from "@/lib/email";
import { sendPostNewsletter, type EmailJob } from "@/lib/newsletter";

/**
 * Jadwalkan email tulisan baru.
 * - Workers (preview/produksi): kirim ke Cloudflare Queue, diproses consumer di worker.ts.
 * - `next dev`: consumer queue tidak berjalan, jadi kirim langsung di background.
 */
export async function enqueuePostEmail(postId: string) {
  const { env, ctx } = getCloudflareContext();
  const job: EmailJob = { type: "post-newsletter", postId };

  if (process.env.NODE_ENV !== "development" && env.EMAIL_QUEUE) {
    await env.EMAIL_QUEUE.send(job);
    return;
  }
  ctx.waitUntil(
    sendPostNewsletter(getDb(), env, postId).catch((e) => console.error("newsletter gagal", e)),
  );
}

/** Email tunggal (mis. konfirmasi langganan), dikirim di background. */
export function sendInBackground(message: EmailMessage) {
  const { env, ctx } = getCloudflareContext();
  ctx.waitUntil(sendEmails(env, [message]).catch((e) => console.error("email gagal", e)));
}
