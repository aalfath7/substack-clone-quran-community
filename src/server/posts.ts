"use server";

import { and, eq, inArray, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getDb, schema } from "@/db";
import { POST_CATEGORIES } from "@/lib/categories";
import { requireUser } from "@/lib/auth";
import { makeExcerpt, renderContentHtml } from "@/lib/content";
import { toSlug } from "@/lib/validation";
import { enqueuePostEmail } from "./email-jobs";
import { getMembership } from "./queries";

const { posts, publications, tags, postTags } = schema;

type Result = { ok?: boolean; message?: string; errors?: Record<string, string> };

/** Ambil tulisan + cek hak edit: penulisnya sendiri, atau owner/editor publikasi. */
async function loadEditablePost(postId: string, userId: string) {
  const post = await getDb().select().from(posts).where(eq(posts.id, postId)).get();
  if (!post) return null;
  const role = await getMembership(post.publicationId, userId);
  if (!role) return null;
  const canEdit = post.authorId === userId || role === "owner" || role === "editor";
  return canEdit ? { post, role } : null;
}

export async function createDraft(publicationId: string) {
  const user = await requireUser(`/dasbor/publikasi/${publicationId}`);
  const role = await getMembership(publicationId, user.id);
  if (!role) redirect("/dasbor");

  const id = crypto.randomUUID();
  await getDb()
    .insert(posts)
    .values({
      id,
      publicationId,
      authorId: user.id,
      slug: `draf-${id.slice(0, 8)}`,
      title: "",
      contentJson: { type: "doc", content: [{ type: "paragraph" }] },
    });
  redirect(`/dasbor/tulisan/${id}`);
}

const MAX_CONTENT_BYTES = 300_000;

const saveSchema = z.object({
  title: z.string().trim().max(200, "Judul maksimal 200 karakter"),
  subtitle: z.string().trim().max(300, "Subjudul maksimal 300 karakter"),
  coverUrl: z
    .string()
    .regex(/^\/media\/cover\/[0-9a-f-]{36}\.(jpg|png|webp)$/)
    .nullable(),
  category: z.enum(POST_CATEGORIES).nullable(),
  tags: z
    .array(z.string().trim().min(1).max(30))
    .max(5, "Maksimal 5 tag"),
  contentJson: z.object({ type: z.literal("doc") }).passthrough(),
});

export type SaveInput = z.input<typeof saveSchema>;

async function syncTags(postId: string, names: string[]) {
  const db = getDb();
  const wanted = [...new Map(names.map((n) => [toSlug(n), n.trim()])).entries()].filter(([slug]) => slug.length > 0);
  await db.delete(postTags).where(eq(postTags.postId, postId));
  if (wanted.length === 0) return;

  await db
    .insert(tags)
    .values(wanted.map(([slug, name]) => ({ slug, name })))
    .onConflictDoNothing({ target: tags.slug });
  const rows = await db
    .select({ id: tags.id })
    .from(tags)
    .where(inArray(tags.slug, wanted.map(([slug]) => slug)));
  await db.insert(postTags).values(rows.map((r) => ({ postId, tagId: r.id }))).onConflictDoNothing();
}

export async function savePost(postId: string, input: SaveInput): Promise<Result> {
  const user = await requireUser(`/dasbor/tulisan/${postId}`);
  const found = await loadEditablePost(postId, user.id);
  if (!found) return { message: "Tulisan tidak ditemukan atau Anda tidak punya akses." };

  const parsed = saveSchema.safeParse(input);
  if (!parsed.success) return { message: parsed.error.issues[0]?.message ?? "Data tidak valid." };
  const data = parsed.data;
  if (JSON.stringify(data.contentJson).length > MAX_CONTENT_BYTES) {
    return { message: "Tulisan terlalu panjang." };
  }

  const isPublished = found.post.status === "published";
  await getDb()
    .update(posts)
    .set({
      title: data.title,
      subtitle: data.subtitle || null,
      coverUrl: data.coverUrl,
      category: data.category,
      contentJson: data.contentJson,
      // Tulisan yang sudah terbit langsung diperbarui versi publiknya.
      ...(isPublished
        ? { contentHtml: renderContentHtml(data.contentJson), excerpt: makeExcerpt(data.contentJson) }
        : {}),
    })
    .where(eq(posts.id, postId));
  await syncTags(postId, data.tags);

  if (isPublished) await revalidatePublicPaths(found.post.publicationId, found.post.slug);
  return { ok: true, message: "Tersimpan." };
}

async function revalidatePublicPaths(publicationId: string, postSlug?: string) {
  const pub = await getDb()
    .select({ slug: publications.slug })
    .from(publications)
    .where(eq(publications.id, publicationId))
    .get();
  if (!pub) return;
  revalidatePath(`/pub/${pub.slug}`);
  if (postSlug) revalidatePath(`/pub/${pub.slug}/p/${postSlug}`);
  revalidatePath("/");
}

async function uniquePostSlug(publicationId: string, title: string, postId: string) {
  const base = toSlug(title).slice(0, 60) || "tulisan";
  const db = getDb();
  for (let i = 0; i < 20; i++) {
    const candidate = i === 0 ? base : `${base}-${i + 1}`;
    const taken = await db
      .select({ id: posts.id })
      .from(posts)
      .where(and(eq(posts.publicationId, publicationId), eq(posts.slug, candidate), ne(posts.id, postId)))
      .get();
    if (!taken) return candidate;
  }
  return `${base}-${postId.slice(0, 6)}`;
}

export async function publishPost(postId: string, opts: { sendEmail: boolean }): Promise<Result & { url?: string }> {
  const user = await requireUser(`/dasbor/tulisan/${postId}`);
  const found = await loadEditablePost(postId, user.id);
  if (!found) return { message: "Tulisan tidak ditemukan atau Anda tidak punya akses." };
  const { post } = found;

  if (post.title.trim().length < 3) return { message: "Beri judul minimal 3 karakter sebelum menerbitkan." };
  const excerpt = makeExcerpt(post.contentJson);
  if (!excerpt) return { message: "Isi tulisan masih kosong." };

  // Slug final dibuat sekali saat pertama terbit; setelah itu tetap agar tautan tidak rusak.
  const slug = post.status === "draft" && post.slug.startsWith("draf-")
    ? await uniquePostSlug(post.publicationId, post.title, post.id)
    : post.slug;

  await getDb()
    .update(posts)
    .set({
      slug,
      status: "published",
      publishedAt: post.publishedAt ?? new Date(),
      contentHtml: renderContentHtml(post.contentJson),
      excerpt,
    })
    .where(eq(posts.id, postId));

  if (opts.sendEmail && !post.emailedAt) await enqueuePostEmail(postId);

  await revalidatePublicPaths(post.publicationId, slug);
  const pub = await getDb()
    .select({ slug: publications.slug })
    .from(publications)
    .where(eq(publications.id, post.publicationId))
    .get();
  return { ok: true, message: "Tulisan terbit.", url: `/@${pub?.slug}/p/${slug}` };
}

export async function unpublishPost(postId: string): Promise<Result> {
  const user = await requireUser(`/dasbor/tulisan/${postId}`);
  const found = await loadEditablePost(postId, user.id);
  if (!found) return { message: "Tulisan tidak ditemukan atau Anda tidak punya akses." };

  await getDb().update(posts).set({ status: "draft" }).where(eq(posts.id, postId));
  await revalidatePublicPaths(found.post.publicationId, found.post.slug);
  return { ok: true, message: "Tulisan dikembalikan ke draf." };
}

export async function deletePost(postId: string) {
  const user = await requireUser(`/dasbor/tulisan/${postId}`);
  const found = await loadEditablePost(postId, user.id);
  if (!found) return { message: "Tulisan tidak ditemukan atau Anda tidak punya akses." };

  await getDb().delete(posts).where(eq(posts.id, postId));
  await revalidatePublicPaths(found.post.publicationId, found.post.slug);
  redirect(`/dasbor/publikasi/${found.post.publicationId}`);
}
