"use server";

import { and, count, eq, gt, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb, schema } from "@/db";
import { LIKE_TARGETS, REPORT_TARGETS } from "@/db/schema";
import { getSession, requireUser } from "@/lib/auth";
import { escapeHtml } from "@/lib/content";
import { appUrl, emailLayout } from "@/lib/email";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { sendInBackground } from "./email-jobs";
import { canManagePublication, getMembership } from "./queries";

const { subscriptions, publications, likes, bookmarks, comments, follows, notes, reports, posts } = schema;

export type ActionState = { ok?: boolean; message?: string; errors?: Record<string, string> };

// ─── Berlangganan (#10) ─────────────────────────────────────────────────────

const emailSchema = z.email("Email tidak valid").max(254).transform((e) => e.trim().toLowerCase());

export async function subscribe(publicationId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const db = getDb();
  const pub = await db
    .select({ id: publications.id, name: publications.name, slug: publications.slug })
    .from(publications)
    .where(eq(publications.id, publicationId))
    .get();
  if (!pub) return { message: "Publikasi tidak ditemukan." };

  const session = await getSession();

  // Pengguna yang sudah masuk: langsung aktif (email akun sudah diketahui).
  if (session) {
    const email = session.user.email.toLowerCase();
    await db
      .insert(subscriptions)
      .values({ publicationId, userId: session.user.id, email, status: "active" })
      .onConflictDoUpdate({
        target: [subscriptions.publicationId, subscriptions.email],
        set: { status: "active", userId: session.user.id },
      });
    revalidatePath(`/pub/${pub.slug}`);
    return { ok: true, message: `Anda berlangganan ${pub.name}.` };
  }

  // Tanpa akun: double opt-in lewat email konfirmasi.
  const parsed = emailSchema.safeParse(formData.get("email") ?? "");
  if (!parsed.success) return { errors: { email: "Email tidak valid" } };
  const email = parsed.data;

  const existing = await db
    .select()
    .from(subscriptions)
    .where(and(eq(subscriptions.publicationId, publicationId), eq(subscriptions.email, email)))
    .get();
  // Pesan sama untuk semua kasus agar status langganan email orang lain tidak bocor.
  const generic: ActionState = { ok: true, message: "Cek email Anda untuk mengonfirmasi langganan." };
  if (existing?.status === "active") return generic;

  let token = existing?.token;
  if (existing) {
    await db.update(subscriptions).set({ status: "pending" }).where(eq(subscriptions.id, existing.id));
  } else {
    const [row] = await db
      .insert(subscriptions)
      .values({ publicationId, email, status: "pending" })
      .returning({ token: subscriptions.token });
    token = row.token;
  }

  const { env } = getCloudflareContext();
  const link = `${appUrl(env)}/konfirmasi?t=${token}`;
  sendInBackground({
    to: email,
    subject: `Konfirmasi langganan ${pub.name}`,
    html: emailLayout({
      title: "Konfirmasi langganan",
      bodyHtml: `<p>Assalamu'alaikum,</p><p>Klik tombol di bawah untuk mulai menerima tulisan dari <strong>${escapeHtml(pub.name)}</strong>.</p>
<p><a href="${escapeHtml(link)}" style="display:inline-block;background:#0f6b4f;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;font-family:Arial,sans-serif">Konfirmasi langganan</a></p>`,
      footerHtml: "Jika Anda tidak merasa mendaftar, abaikan email ini.",
    }),
    text: `Konfirmasi langganan ${pub.name}: ${link}\n\nJika Anda tidak merasa mendaftar, abaikan email ini.`,
  });
  return generic;
}

export async function unsubscribeSelf(publicationId: string) {
  const user = await requireUser();
  const db = getDb();
  await db
    .update(subscriptions)
    .set({ status: "unsubscribed" })
    .where(and(eq(subscriptions.publicationId, publicationId), eq(subscriptions.email, user.email.toLowerCase())));
  const pub = await db.select({ slug: publications.slug }).from(publications).where(eq(publications.id, publicationId)).get();
  if (pub) revalidatePath(`/pub/${pub.slug}`);
}

export async function unsubscribeByToken(token: string): Promise<ActionState> {
  if (!/^[0-9a-f]{64}$/.test(token)) return { message: "Tautan tidak valid." };
  const res = await getDb()
    .update(subscriptions)
    .set({ status: "unsubscribed" })
    .where(eq(subscriptions.token, token))
    .returning({ id: subscriptions.id });
  return res.length ? { ok: true, message: "Anda sudah berhenti berlangganan." } : { message: "Tautan tidak valid." };
}

// ─── Suka & simpan (#11) ────────────────────────────────────────────────────

type LikeResult = { needLogin: true } | { error: string } | { liked: boolean; count: number };

export async function toggleLike(targetType: (typeof LIKE_TARGETS)[number], targetId: string): Promise<LikeResult> {
  const session = await getSession();
  if (!session) return { needLogin: true };
  if (!LIKE_TARGETS.includes(targetType)) return { error: "Tidak valid" };

  const db = getDb();
  const where = and(eq(likes.userId, session.user.id), eq(likes.targetType, targetType), eq(likes.targetId, targetId));
  const existing = await db.select({ t: likes.targetId }).from(likes).where(where).get();
  if (existing) await db.delete(likes).where(where);
  else await db.insert(likes).values({ userId: session.user.id, targetType, targetId }).onConflictDoNothing();

  const [{ n }] = await db
    .select({ n: count() })
    .from(likes)
    .where(and(eq(likes.targetType, targetType), eq(likes.targetId, targetId)));
  return { liked: !existing, count: n };
}

export async function toggleBookmark(postId: string) {
  const session = await getSession();
  if (!session) return { needLogin: true as const };
  const db = getDb();
  const where = and(eq(bookmarks.userId, session.user.id), eq(bookmarks.postId, postId));
  const existing = await db.select({ p: bookmarks.postId }).from(bookmarks).where(where).get();
  if (existing) await db.delete(bookmarks).where(where);
  else await db.insert(bookmarks).values({ userId: session.user.id, postId }).onConflictDoNothing();
  revalidatePath("/tersimpan");
  return { saved: !existing };
}

// ─── Komentar (#11) ─────────────────────────────────────────────────────────

const commentSchema = z.string().trim().min(1, "Komentar kosong").max(3000, "Maksimal 3000 karakter");

export async function addComment(
  postId: string,
  parentId: string | null,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const parsed = commentSchema.safeParse(formData.get("body") ?? "");
  if (!parsed.success) return { errors: { body: parsed.error.issues[0].message } };

  const db = getDb();
  const post = await db
    .select({ id: posts.id, slug: posts.slug, pubSlug: publications.slug })
    .from(posts)
    .innerJoin(publications, eq(publications.id, posts.publicationId))
    .where(and(eq(posts.id, postId), eq(posts.status, "published")))
    .get();
  if (!post) return { message: "Tulisan tidak ditemukan." };

  // Balasan selalu menempel ke komentar utama (satu tingkat).
  let parent: string | null = null;
  if (parentId) {
    const p = await db
      .select({ id: comments.id, parentId: comments.parentId })
      .from(comments)
      .where(and(eq(comments.id, parentId), eq(comments.postId, postId)))
      .get();
    if (!p) return { message: "Komentar yang dibalas tidak ditemukan." };
    parent = p.parentId ?? p.id;
  }

  // Batas sederhana: maksimal 10 komentar per menit per pengguna.
  const recent = await db.$count(
    comments,
    and(eq(comments.userId, user.id), gt(comments.createdAt, new Date(Date.now() - 60_000))),
  );
  if (recent >= 10) return { message: "Terlalu cepat. Tunggu sebentar sebelum berkomentar lagi." };

  await db.insert(comments).values({ postId, userId: user.id, parentId: parent, body: parsed.data });
  revalidatePath(`/pub/${post.pubSlug}/p/${post.slug}`);
  return { ok: true };
}

export async function deleteComment(commentId: string) {
  const user = await requireUser();
  const db = getDb();
  const c = await db
    .select({ id: comments.id, userId: comments.userId, publicationId: posts.publicationId, postSlug: posts.slug, pubSlug: publications.slug })
    .from(comments)
    .innerJoin(posts, eq(posts.id, comments.postId))
    .innerJoin(publications, eq(publications.id, posts.publicationId))
    .where(eq(comments.id, commentId))
    .get();
  if (!c) return;
  const allowed =
    c.userId === user.id || user.role === "admin" || canManagePublication(await getMembership(c.publicationId, user.id));
  if (!allowed) return;
  await db.update(comments).set({ deletedAt: new Date() }).where(eq(comments.id, commentId));
  revalidatePath(`/pub/${c.pubSlug}/p/${c.postSlug}`);
}

// ─── Ikuti & catatan (#12) ──────────────────────────────────────────────────

type FollowResult = { needLogin: true } | { error: string } | { following: boolean; followers: number };

export async function toggleFollow(targetUserId: string): Promise<FollowResult> {
  const session = await getSession();
  if (!session) return { needLogin: true as const };
  if (targetUserId === session.user.id) return { error: "Tidak bisa mengikuti diri sendiri" };
  const db = getDb();
  const where = and(eq(follows.followerId, session.user.id), eq(follows.followingId, targetUserId));
  const existing = await db.select({ f: follows.followerId }).from(follows).where(where).get();
  if (existing) await db.delete(follows).where(where);
  else await db.insert(follows).values({ followerId: session.user.id, followingId: targetUserId }).onConflictDoNothing();
  const [{ n }] = await db.select({ n: count() }).from(follows).where(eq(follows.followingId, targetUserId));
  return { following: !existing, followers: n };
}

const noteSchema = z.string().trim().min(1, "Catatan kosong").max(1000, "Maksimal 1000 karakter");

export async function createNote(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser("/catatan");
  const parsed = noteSchema.safeParse(formData.get("body") ?? "");
  if (!parsed.success) return { errors: { body: parsed.error.issues[0].message } };
  await getDb().insert(notes).values({ authorId: user.id, body: parsed.data });
  revalidatePath("/catatan");
  revalidatePath("/");
  if (user.username) revalidatePath(`/u/${user.username}`);
  return { ok: true };
}

export async function deleteNote(noteId: string) {
  const user = await requireUser();
  const db = getDb();
  const n = await db.select({ authorId: notes.authorId }).from(notes).where(eq(notes.id, noteId)).get();
  if (!n || (n.authorId !== user.id && user.role !== "admin")) return;
  await db.update(notes).set({ deletedAt: new Date() }).where(and(eq(notes.id, noteId), isNull(notes.deletedAt)));
  revalidatePath("/catatan");
  revalidatePath("/");
}

// ─── Laporan (#16) ──────────────────────────────────────────────────────────

const reportSchema = z.object({
  targetType: z.enum(REPORT_TARGETS),
  targetId: z.string().uuid(),
  reason: z.string().trim().min(5, "Jelaskan minimal 5 karakter").max(500, "Maksimal 500 karakter"),
});

export async function reportContent(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const parsed = reportSchema.safeParse({
    targetType: formData.get("targetType"),
    targetId: formData.get("targetId"),
    reason: formData.get("reason") ?? "",
  });
  if (!parsed.success) return { errors: { reason: parsed.error.issues[0].message } };
  await getDb()
    .insert(reports)
    .values({ reporterId: user.id, ...parsed.data })
    .onConflictDoNothing();
  return { ok: true, message: "Terima kasih, laporan Anda akan ditinjau admin." };
}
