import { sql } from "drizzle-orm";
import {
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { POST_CATEGORIES } from "../lib/categories";

// Konvensi:
// - Kunci TS camelCase, kolom DB snake_case (diatur `casing: "snake_case"` di drizzle).
// - ID string (crypto.randomUUID()).
// - Waktu disimpan integer epoch ms.

const id = () =>
  text()
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID());

const createdAt = () =>
  integer({ mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`);

const updatedAt = () =>
  integer({ mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`)
    .$onUpdateFn(() => new Date());

// ─── Auth (bentuk tabel mengikuti Better Auth, mode usePlural) ──────────────

export const users = sqliteTable("users", {
  id: id(),
  name: text().notNull(),
  email: text().notNull().unique(),
  emailVerified: integer({ mode: "boolean" }).notNull().default(false),
  image: text(),
  // Tambahan aplikasi
  username: text().unique(),
  bio: text(),
  role: text({ enum: ["user", "admin"] }).notNull().default("user"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const sessions = sqliteTable(
  "sessions",
  {
    id: id(),
    expiresAt: integer({ mode: "timestamp_ms" }).notNull(),
    token: text().notNull().unique(),
    ipAddress: text(),
    userAgent: text(),
    userId: text()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("sessions_user_id_idx").on(t.userId)],
);

export const accounts = sqliteTable(
  "accounts",
  {
    id: id(),
    accountId: text().notNull(),
    providerId: text().notNull(),
    userId: text()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    accessToken: text(),
    refreshToken: text(),
    idToken: text(),
    accessTokenExpiresAt: integer({ mode: "timestamp_ms" }),
    refreshTokenExpiresAt: integer({ mode: "timestamp_ms" }),
    scope: text(),
    password: text(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("accounts_user_id_idx").on(t.userId)],
);

export const verifications = sqliteTable(
  "verifications",
  {
    id: id(),
    identifier: text().notNull(),
    value: text().notNull(),
    expiresAt: integer({ mode: "timestamp_ms" }).notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("verifications_identifier_idx").on(t.identifier)],
);

// ─── Publikasi ──────────────────────────────────────────────────────────────

export const publications = sqliteTable(
  "publications",
  {
    id: id(),
    ownerId: text()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    slug: text().notNull().unique(),
    name: text().notNull(),
    tagline: text(),
    description: text(),
    logoUrl: text(),
    // Dukungan/infaq (Fase 5): tautan eksternal + ajakan singkat
    supportUrl: text(),
    supportText: text(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("publications_owner_id_idx").on(t.ownerId)],
);

export const publicationMembers = sqliteTable(
  "publication_members",
  {
    publicationId: text()
      .notNull()
      .references(() => publications.id, { onDelete: "cascade" }),
    userId: text()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text({ enum: ["owner", "editor", "writer"] }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    primaryKey({ columns: [t.publicationId, t.userId] }),
    index("publication_members_user_id_idx").on(t.userId),
  ],
);

// ─── Tulisan ────────────────────────────────────────────────────────────────

export { POST_CATEGORIES };

export const posts = sqliteTable(
  "posts",
  {
    id: id(),
    publicationId: text()
      .notNull()
      .references(() => publications.id, { onDelete: "cascade" }),
    authorId: text()
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    slug: text().notNull(),
    title: text().notNull(),
    subtitle: text(),
    coverUrl: text(),
    contentJson: text({ mode: "json" }),
    contentHtml: text(),
    category: text({ enum: POST_CATEGORIES }),
    status: text({ enum: ["draft", "published", "archived"] })
      .notNull()
      .default("draft"),
    excerpt: text(),
    viewCount: integer().notNull().default(0),
    publishedAt: integer({ mode: "timestamp_ms" }),
    emailedAt: integer({ mode: "timestamp_ms" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("posts_publication_slug_uq").on(t.publicationId, t.slug),
    index("posts_publication_status_published_idx").on(
      t.publicationId,
      t.status,
      t.publishedAt,
    ),
    index("posts_status_published_idx").on(t.status, t.publishedAt),
    index("posts_author_id_idx").on(t.authorId),
  ],
);

export const tags = sqliteTable("tags", {
  id: id(),
  slug: text().notNull().unique(),
  name: text().notNull(),
  createdAt: createdAt(),
});

export const postTags = sqliteTable(
  "post_tags",
  {
    postId: text()
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    tagId: text()
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
  },
  (t) => [
    primaryKey({ columns: [t.postId, t.tagId] }),
    index("post_tags_tag_id_idx").on(t.tagId),
  ],
);

// ─── Komunitas (Fase 3) ─────────────────────────────────────────────────────

export const subscriptions = sqliteTable(
  "subscriptions",
  {
    id: id(),
    publicationId: text()
      .notNull()
      .references(() => publications.id, { onDelete: "cascade" }),
    userId: text().references(() => users.id, { onDelete: "set null" }),
    email: text().notNull(),
    // pending = menunggu konfirmasi email (pelanggan tanpa akun)
    status: text({ enum: ["pending", "active", "unsubscribed"] }).notNull().default("active"),
    token: text()
      .notNull()
      .unique()
      .$defaultFn(() => crypto.randomUUID().replaceAll("-", "") + crypto.randomUUID().replaceAll("-", "")),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("subscriptions_publication_email_uq").on(t.publicationId, t.email),
    index("subscriptions_publication_status_idx").on(t.publicationId, t.status),
    index("subscriptions_user_id_idx").on(t.userId),
  ],
);

export const follows = sqliteTable(
  "follows",
  {
    followerId: text()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    followingId: text()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
  },
  (t) => [
    primaryKey({ columns: [t.followerId, t.followingId] }),
    index("follows_following_id_idx").on(t.followingId),
  ],
);

export const comments = sqliteTable(
  "comments",
  {
    id: id(),
    postId: text()
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    userId: text()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    // Balasan hanya satu tingkat: parentId selalu menunjuk komentar utama.
    parentId: text(),
    body: text().notNull(),
    createdAt: createdAt(),
    deletedAt: integer({ mode: "timestamp_ms" }),
  },
  (t) => [index("comments_post_id_idx").on(t.postId, t.createdAt), index("comments_user_id_idx").on(t.userId)],
);

export const LIKE_TARGETS = ["post", "note", "comment"] as const;

export const likes = sqliteTable(
  "likes",
  {
    userId: text()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    targetType: text({ enum: LIKE_TARGETS }).notNull(),
    targetId: text().notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.targetType, t.targetId] }),
    index("likes_target_idx").on(t.targetType, t.targetId),
  ],
);

export const bookmarks = sqliteTable(
  "bookmarks",
  {
    userId: text()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    postId: text()
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.postId] })],
);

export const notes = sqliteTable(
  "notes",
  {
    id: id(),
    authorId: text()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    body: text().notNull(),
    createdAt: createdAt(),
    deletedAt: integer({ mode: "timestamp_ms" }),
  },
  (t) => [index("notes_author_created_idx").on(t.authorId, t.createdAt), index("notes_created_idx").on(t.createdAt)],
);

export const recommendations = sqliteTable(
  "recommendations",
  {
    publicationId: text()
      .notNull()
      .references(() => publications.id, { onDelete: "cascade" }),
    recommendedPublicationId: text()
      .notNull()
      .references(() => publications.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.publicationId, t.recommendedPublicationId] })],
);

// ─── Moderasi (Fase 4) ──────────────────────────────────────────────────────

export const REPORT_TARGETS = ["post", "note", "comment"] as const;

export const reports = sqliteTable(
  "reports",
  {
    id: id(),
    reporterId: text()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    targetType: text({ enum: REPORT_TARGETS }).notNull(),
    targetId: text().notNull(),
    reason: text().notNull(),
    status: text({ enum: ["open", "resolved", "dismissed"] }).notNull().default("open"),
    resolvedBy: text().references(() => users.id, { onDelete: "set null" }),
    resolvedAt: integer({ mode: "timestamp_ms" }),
    createdAt: createdAt(),
  },
  (t) => [
    index("reports_status_created_idx").on(t.status, t.createdAt),
    uniqueIndex("reports_reporter_target_uq").on(t.reporterId, t.targetType, t.targetId),
  ],
);
