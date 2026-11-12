import "server-only";
import { and, asc, count, desc, eq, inArray, isNull, lt } from "drizzle-orm";
import { cache } from "react";
import { getDb, schema } from "@/db";

const { users, publications, publicationMembers } = schema;

export type MemberRole = (typeof publicationMembers.$inferSelect)["role"];

export const getUserByUsername = cache(async (username: string) => {
  return getDb()
    .select({
      id: users.id,
      name: users.name,
      username: users.username,
      bio: users.bio,
      image: users.image,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.username, username.toLowerCase()))
    .get();
});

export const getPublicationBySlug = cache(async (slug: string) => {
  return getDb()
    .select({
      publication: publications,
      owner: { name: users.name, username: users.username, image: users.image },
    })
    .from(publications)
    .innerJoin(users, eq(users.id, publications.ownerId))
    .where(eq(publications.slug, slug.toLowerCase()))
    .get();
});

/** Publikasi tempat user menjadi anggota (owner/editor/writer). */
export async function getUserPublications(userId: string) {
  return getDb()
    .select({
      id: publications.id,
      slug: publications.slug,
      name: publications.name,
      tagline: publications.tagline,
      role: publicationMembers.role,
    })
    .from(publicationMembers)
    .innerJoin(publications, eq(publications.id, publicationMembers.publicationId))
    .where(eq(publicationMembers.userId, userId))
    .orderBy(asc(publications.name));
}

/** Publikasi milik user (untuk profil publik). */
export async function getOwnedPublications(userId: string) {
  return getDb()
    .select({
      slug: publications.slug,
      name: publications.name,
      tagline: publications.tagline,
    })
    .from(publications)
    .where(eq(publications.ownerId, userId))
    .orderBy(desc(publications.createdAt));
}

/** Peran user di publikasi, atau null jika bukan anggota. */
export async function getMembership(publicationId: string, userId: string) {
  const row = await getDb()
    .select({ role: publicationMembers.role })
    .from(publicationMembers)
    .where(
      and(eq(publicationMembers.publicationId, publicationId), eq(publicationMembers.userId, userId)),
    )
    .get();
  return row?.role ?? null;
}

export function canManagePublication(role: MemberRole | null) {
  return role === "owner" || role === "editor";
}

// ─── Tulisan ────────────────────────────────────────────────────────────────

const { posts, tags, postTags, comments, likes } = schema;

export async function getPublicationById(id: string) {
  return getDb().select().from(publications).where(eq(publications.id, id)).get();
}

/** Semua tulisan publikasi untuk dasbor (draf + terbit). */
export async function getDashboardPosts(publicationId: string) {
  return getDb()
    .select({
      id: posts.id,
      title: posts.title,
      slug: posts.slug,
      status: posts.status,
      publishedAt: posts.publishedAt,
      updatedAt: posts.updatedAt,
      viewCount: posts.viewCount,
      emailedAt: posts.emailedAt,
      authorId: posts.authorId,
      authorName: users.name,
    })
    .from(posts)
    .innerJoin(users, eq(users.id, posts.authorId))
    .where(eq(posts.publicationId, publicationId))
    .orderBy(desc(posts.updatedAt));
}

export async function getPostTags(postId: string) {
  return getDb()
    .select({ slug: tags.slug, name: tags.name })
    .from(postTags)
    .innerJoin(tags, eq(tags.id, postTags.tagId))
    .where(eq(postTags.postId, postId))
    .orderBy(asc(tags.name));
}

/** Kolom ringkas tulisan untuk daftar/feed. */
export const postCardFields = {
  id: posts.id,
  slug: posts.slug,
  title: posts.title,
  subtitle: posts.subtitle,
  excerpt: posts.excerpt,
  coverUrl: posts.coverUrl,
  category: posts.category,
  publishedAt: posts.publishedAt,
  pubSlug: publications.slug,
  pubName: publications.name,
  authorName: users.name,
  authorUsername: users.username,
  authorImage: users.image,
};

export type PostCard = {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  excerpt: string | null;
  coverUrl: string | null;
  category: string | null;
  publishedAt: Date | null;
  pubSlug: string;
  pubName: string;
  authorName: string;
  authorUsername: string | null;
  authorImage: string | null;
};

export async function getPublishedPostsOfPublication(publicationId: string, before?: Date, limit = 10) {
  return getDb()
    .select(postCardFields)
    .from(posts)
    .innerJoin(publications, eq(publications.id, posts.publicationId))
    .innerJoin(users, eq(users.id, posts.authorId))
    .where(
      and(
        eq(posts.publicationId, publicationId),
        eq(posts.status, "published"),
        before ? lt(posts.publishedAt, before) : undefined,
      ),
    )
    .orderBy(desc(posts.publishedAt))
    .limit(limit);
}

export const getPublishedPost = cache(async (pubSlug: string, postSlug: string) => {
  return getDb()
    .select({
      post: posts,
      pub: publications,
      author: { id: users.id, name: users.name, username: users.username, image: users.image, bio: users.bio },
    })
    .from(posts)
    .innerJoin(publications, eq(publications.id, posts.publicationId))
    .innerJoin(users, eq(users.id, posts.authorId))
    .where(
      and(
        eq(publications.slug, pubSlug.toLowerCase()),
        eq(posts.slug, postSlug.toLowerCase()),
        eq(posts.status, "published"),
      ),
    )
    .get();
});

/** Jumlah suka & komentar untuk sekumpulan tulisan. */
export async function getPostCounts(postIds: string[]) {
  const out = new Map<string, { likes: number; comments: number }>();
  if (postIds.length === 0) return out;
  const db = getDb();
  const [likeRows, commentRows] = await Promise.all([
    db
      .select({ id: likes.targetId, n: count() })
      .from(likes)
      .where(and(eq(likes.targetType, "post"), inArray(likes.targetId, postIds)))
      .groupBy(likes.targetId),
    db
      .select({ id: comments.postId, n: count() })
      .from(comments)
      .where(and(inArray(comments.postId, postIds), isNull(comments.deletedAt)))
      .groupBy(comments.postId),
  ]);
  for (const id of postIds) out.set(id, { likes: 0, comments: 0 });
  for (const r of likeRows) out.get(r.id)!.likes = r.n;
  for (const r of commentRows) out.get(r.id)!.comments = r.n;
  return out;
}

// ─── Status pengguna & komunitas ────────────────────────────────────────────

const { subscriptions, bookmarks, follows, recommendations, notes } = schema;

export async function isSubscribed(publicationId: string, email: string | undefined) {
  if (!email) return false;
  const row = await getDb()
    .select({ s: subscriptions.status })
    .from(subscriptions)
    .where(and(eq(subscriptions.publicationId, publicationId), eq(subscriptions.email, email.toLowerCase())))
    .get();
  return row?.s === "active";
}

export async function getSubscriberCount(publicationId: string) {
  return getDb().$count(subscriptions, and(eq(subscriptions.publicationId, publicationId), eq(subscriptions.status, "active")));
}

/** ID target (dari daftar) yang sudah disukai user. */
export async function getLikedIds(userId: string | undefined, targetType: "post" | "note" | "comment", ids: string[]) {
  if (!userId || ids.length === 0) return new Set<string>();
  const rows = await getDb()
    .select({ id: likes.targetId })
    .from(likes)
    .where(and(eq(likes.userId, userId), eq(likes.targetType, targetType), inArray(likes.targetId, ids)));
  return new Set(rows.map((r) => r.id));
}

export async function getLikeCounts(targetType: "post" | "note" | "comment", ids: string[]) {
  const out = new Map<string, number>();
  if (ids.length === 0) return out;
  const rows = await getDb()
    .select({ id: likes.targetId, n: count() })
    .from(likes)
    .where(and(eq(likes.targetType, targetType), inArray(likes.targetId, ids)))
    .groupBy(likes.targetId);
  for (const r of rows) out.set(r.id, r.n);
  return out;
}

export async function isBookmarked(userId: string | undefined, postId: string) {
  if (!userId) return false;
  const row = await getDb()
    .select({ p: bookmarks.postId })
    .from(bookmarks)
    .where(and(eq(bookmarks.userId, userId), eq(bookmarks.postId, postId)))
    .get();
  return Boolean(row);
}

export async function getComments(postId: string) {
  return getDb()
    .select({
      id: comments.id,
      parentId: comments.parentId,
      body: comments.body,
      createdAt: comments.createdAt,
      deletedAt: comments.deletedAt,
      userId: comments.userId,
      userName: users.name,
      username: users.username,
      userImage: users.image,
    })
    .from(comments)
    .innerJoin(users, eq(users.id, comments.userId))
    .where(eq(comments.postId, postId))
    .orderBy(asc(comments.createdAt))
    .limit(500);
}

export async function getRecommendations(publicationId: string) {
  return getDb()
    .select({ slug: publications.slug, name: publications.name, tagline: publications.tagline, logoUrl: publications.logoUrl })
    .from(recommendations)
    .innerJoin(publications, eq(publications.id, recommendations.recommendedPublicationId))
    .where(eq(recommendations.publicationId, publicationId))
    .orderBy(asc(publications.name));
}

export async function getFollowInfo(targetUserId: string, viewerId: string | undefined) {
  const db = getDb();
  const [followers, following, mine] = await Promise.all([
    db.$count(follows, eq(follows.followingId, targetUserId)),
    db.$count(follows, eq(follows.followerId, targetUserId)),
    viewerId
      ? db
          .select({ f: follows.followerId })
          .from(follows)
          .where(and(eq(follows.followerId, viewerId), eq(follows.followingId, targetUserId)))
          .get()
      : Promise.resolve(undefined),
  ]);
  return { followers, following, isFollowing: Boolean(mine) };
}

export type NoteItem = {
  id: string;
  body: string;
  createdAt: Date;
  authorId: string;
  authorName: string;
  authorUsername: string | null;
  authorImage: string | null;
};

export const noteFields = {
  id: notes.id,
  body: notes.body,
  createdAt: notes.createdAt,
  authorId: notes.authorId,
  authorName: users.name,
  authorUsername: users.username,
  authorImage: users.image,
};

export async function getNotes(opts: { authorIds?: string[]; before?: Date; limit?: number } = {}) {
  if (opts.authorIds && opts.authorIds.length === 0) return [];
  return getDb()
    .select(noteFields)
    .from(notes)
    .innerJoin(users, eq(users.id, notes.authorId))
    .where(
      and(
        isNull(notes.deletedAt),
        opts.authorIds ? inArray(notes.authorId, opts.authorIds) : undefined,
        opts.before ? lt(notes.createdAt, opts.before) : undefined,
      ),
    )
    .orderBy(desc(notes.createdAt))
    .limit(opts.limit ?? 30);
}

/** Lengkapi catatan dengan status suka milik pembaca. */
export async function withNoteLikes(list: NoteItem[], viewerId: string | undefined) {
  const ids = list.map((n) => n.id);
  const [liked, counts] = await Promise.all([getLikedIds(viewerId, "note", ids), getLikeCounts("note", ids)]);
  return list.map((n) => ({ ...n, liked: liked.has(n.id), likes: counts.get(n.id) ?? 0 }));
}

/** Tulisan terbit terbaru (opsional: hanya dari publikasi tertentu). */
export async function getLatestPosts(opts: { publicationIds?: string[]; before?: Date; limit?: number } = {}) {
  if (opts.publicationIds && opts.publicationIds.length === 0) return [];
  return getDb()
    .select(postCardFields)
    .from(posts)
    .innerJoin(publications, eq(publications.id, posts.publicationId))
    .innerJoin(users, eq(users.id, posts.authorId))
    .where(
      and(
        eq(posts.status, "published"),
        opts.publicationIds ? inArray(posts.publicationId, opts.publicationIds) : undefined,
        opts.before ? lt(posts.publishedAt, opts.before) : undefined,
      ),
    )
    .orderBy(desc(posts.publishedAt))
    .limit(opts.limit ?? 20);
}

/** ID publikasi yang dilanggan user + ID pengguna yang diikuti. */
export async function getFeedSources(userId: string, email: string) {
  const db = getDb();
  const [subs, followed] = await Promise.all([
    db
      .select({ id: subscriptions.publicationId })
      .from(subscriptions)
      .where(and(eq(subscriptions.email, email.toLowerCase()), eq(subscriptions.status, "active"))),
    db.select({ id: follows.followingId }).from(follows).where(eq(follows.followerId, userId)),
  ]);
  return { publicationIds: subs.map((s) => s.id), followingIds: followed.map((f) => f.id) };
}
