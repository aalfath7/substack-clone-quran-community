// Kirim tulisan baru ke semua pelanggan aktif. Dipanggil oleh consumer queue (worker.ts)
// atau langsung saat `next dev`. Hanya pakai import relatif agar bisa dibundel wrangler.
import { and, eq, gt, isNull } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import * as schema from "../db/schema";
import { escapeHtml } from "./content";
import { appUrl, emailLayout, sendEmails, type EmailEnv } from "./email";

type Db = DrizzleD1Database<typeof schema>;

export type EmailJob = { type: "post-newsletter"; postId: string };

const PAGE = 500;

export async function sendPostNewsletter(db: Db, env: EmailEnv, postId: string) {
  const { posts, publications, users, subscriptions } = schema;

  // Klaim tulisan secara atomik: hanya satu proses yang berhasil mengisi emailedAt.
  const claimed = await db
    .update(posts)
    .set({ emailedAt: new Date() })
    .where(and(eq(posts.id, postId), eq(posts.status, "published"), isNull(posts.emailedAt)))
    .returning({ id: posts.id });
  if (claimed.length === 0) return { sent: 0, skipped: true };

  const row = await db
    .select({ post: posts, pub: publications, author: { name: users.name } })
    .from(posts)
    .innerJoin(publications, eq(publications.id, posts.publicationId))
    .innerJoin(users, eq(users.id, posts.authorId))
    .where(eq(posts.id, postId))
    .get();
  if (!row) return { sent: 0, skipped: true };

  const base = appUrl(env);
  const postUrl = `${base}/@${row.pub.slug}/p/${row.post.slug}`;
  const title = escapeHtml(row.post.title);
  const cover = row.post.coverUrl ? `<img src="${escapeHtml(base + row.post.coverUrl)}" alt="" style="width:100%;border-radius:8px;margin-bottom:24px">` : "";
  const bodyHtml = `${cover}
<p style="font-family:Arial,sans-serif;font-size:13px;color:#6b6860;margin:0 0 8px">${escapeHtml(row.pub.name)}</p>
<h1 style="font-size:30px;line-height:1.25;margin:0 0 8px">${title}</h1>
${row.post.subtitle ? `<p style="font-size:19px;color:#6b6860;margin:0 0 8px">${escapeHtml(row.post.subtitle)}</p>` : ""}
<p style="font-family:Arial,sans-serif;font-size:13px;color:#6b6860;margin:0 0 24px">oleh ${escapeHtml(row.author.name)}</p>
${row.post.contentHtml ?? ""}
<p style="margin-top:32px"><a href="${escapeHtml(postUrl)}" style="display:inline-block;background:#0f6b4f;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;font-family:Arial,sans-serif;font-size:15px">Baca di web &amp; beri komentar</a></p>`;

  let sent = 0;
  let cursor = "";
  try {
  for (;;) {
    const subs = await db
      .select({ id: subscriptions.id, email: subscriptions.email, token: subscriptions.token })
      .from(subscriptions)
      .where(
        and(
          eq(subscriptions.publicationId, row.pub.id),
          eq(subscriptions.status, "active"),
          gt(subscriptions.id, cursor),
        ),
      )
      .orderBy(subscriptions.id)
      .limit(PAGE);
    if (subs.length === 0) break;

    await sendEmails(
      env,
      subs.map((s) => {
        const unsub = `${base}/berhenti?t=${s.token}`;
        return {
          to: s.email,
          subject: row.post.title,
          html: emailLayout({
            title,
            bodyHtml,
            footerHtml: `Anda menerima email ini karena berlangganan ${escapeHtml(row.pub.name)}. <a href="${escapeHtml(unsub)}" style="color:#6b6860">Berhenti berlangganan</a>.`,
          }),
          text: `${row.post.title}\n${row.post.subtitle ?? ""}\n\n${row.post.excerpt ?? ""}\n\nBaca selengkapnya: ${postUrl}\n\nBerhenti berlangganan: ${unsub}`,
          headers: {
            "List-Unsubscribe": `<${base}/api/berhenti?t=${s.token}>`,
            "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
          },
        };
      }),
    );
    sent += subs.length;
    cursor = subs[subs.length - 1].id;
  }
  } catch (error) {
    // Belum ada yang terkirim: lepas klaim agar percobaan ulang (queue retry) bisa jalan.
    // Jika sebagian sudah terkirim, klaim dipertahankan agar pelanggan tidak menerima dobel.
    if (sent === 0) await db.update(posts).set({ emailedAt: null }).where(eq(posts.id, postId));
    throw error;
  }
  return { sent, skipped: false };
}
