import type { Metadata } from "next";
import { and, count, desc, eq, gt, inArray, sql } from "drizzle-orm";
import Link from "next/link";
import { PostCard } from "@/components/post-card";
import { Avatar } from "@/components/ui";
import { getDb, schema } from "@/db";
import { CATEGORY_LABEL, POST_CATEGORIES, isCategory } from "@/lib/categories";
import { daysAgo } from "@/lib/format";
import { getPostCounts, postCardFields } from "@/server/queries";

export const metadata: Metadata = { title: "Jelajah", description: "Temukan tulisan dan publikasi Al-Qur'an." };
export const dynamic = "force-dynamic";

const { posts, publications, users, likes, tags, postTags, subscriptions } = schema;

export default async function ExplorePage({ searchParams }: PageProps<"/jelajah">) {
  const sp = await searchParams;
  const kategori = isCategory(sp.kategori) ? sp.kategori : null;
  const tagSlug = typeof sp.tag === "string" && /^[a-z0-9-]{1,40}$/.test(sp.tag) ? sp.tag : null;
  const urut = sp.urut === "populer" ? "populer" : "terbaru";
  const db = getDb();

  const tag = tagSlug ? await db.select().from(tags).where(eq(tags.slug, tagSlug)).get() : undefined;
  const taggedIds = tag
    ? (await db.select({ id: postTags.postId }).from(postTags).where(eq(postTags.tagId, tag.id))).map((r) => r.id)
    : null;

  const filters = and(
    eq(posts.status, "published"),
    kategori ? eq(posts.category, kategori) : undefined,
    taggedIds ? (taggedIds.length ? inArray(posts.id, taggedIds) : sql`0`) : undefined,
  );

  // Populer = paling banyak disukai dalam 30 hari terakhir.
  const since = daysAgo(30);
  const likeCount = db
    .select({ postId: likes.targetId, n: count().as("n") })
    .from(likes)
    .where(and(eq(likes.targetType, "post"), gt(likes.createdAt, since)))
    .groupBy(likes.targetId)
    .as("lc");

  const list =
    urut === "populer"
      ? await db
          .select(postCardFields)
          .from(posts)
          .innerJoin(publications, eq(publications.id, posts.publicationId))
          .innerJoin(users, eq(users.id, posts.authorId))
          .innerJoin(likeCount, eq(likeCount.postId, posts.id))
          .where(filters)
          .orderBy(desc(likeCount.n), desc(posts.publishedAt))
          .limit(30)
      : await db
          .select(postCardFields)
          .from(posts)
          .innerJoin(publications, eq(publications.id, posts.publicationId))
          .innerJoin(users, eq(users.id, posts.authorId))
          .where(filters)
          .orderBy(desc(posts.publishedAt))
          .limit(30);
  const counts = await getPostCounts(list.map((p) => p.id));

  const [topPubs, topTags] = await Promise.all([
    db
      .select({
        slug: publications.slug,
        name: publications.name,
        tagline: publications.tagline,
        logoUrl: publications.logoUrl,
        subs: count(subscriptions.id),
      })
      .from(publications)
      .leftJoin(subscriptions, and(eq(subscriptions.publicationId, publications.id), eq(subscriptions.status, "active")))
      .groupBy(publications.id)
      .orderBy(desc(count(subscriptions.id)))
      .limit(8),
    db
      .select({ slug: tags.slug, name: tags.name, n: count(postTags.postId) })
      .from(tags)
      .innerJoin(postTags, eq(postTags.tagId, tags.id))
      .groupBy(tags.id)
      .orderBy(desc(count(postTags.postId)))
      .limit(20),
  ]);

  const href = (patch: Record<string, string | null>) => {
    const q = new URLSearchParams();
    const next = { kategori, tag: tagSlug, urut: urut === "populer" ? "populer" : null, ...patch };
    for (const [k, v] of Object.entries(next)) if (v) q.set(k, v);
    const s = q.toString();
    return s ? `/jelajah?${s}` : "/jelajah";
  };
  const chip = (active: boolean) =>
    `rounded-full border px-3 py-1 text-sm ${active ? "border-accent bg-accent/10 text-accent" : "border-border text-muted hover:text-foreground"}`;

  return (
    <main className="mx-auto grid w-full max-w-5xl flex-1 gap-12 px-4 py-10 lg:grid-cols-[1fr_260px]">
      <div className="min-w-0">
        <h1 className="font-serif text-3xl font-semibold">
          Jelajah{tag ? ` #${tag.name}` : kategori ? ` · ${CATEGORY_LABEL[kategori]}` : ""}
        </h1>

        <div className="mt-6 flex flex-wrap gap-2">
          <Link href={href({ kategori: null })} className={chip(!kategori)}>
            Semua
          </Link>
          {POST_CATEGORIES.map((c) => (
            <Link key={c} href={href({ kategori: c })} className={chip(kategori === c)}>
              {CATEGORY_LABEL[c]}
            </Link>
          ))}
        </div>

        <div className="mt-4 flex items-center gap-4 border-b border-border text-sm">
          <Link href={href({ urut: null })} className={`-mb-px border-b-2 py-2 ${urut === "terbaru" ? "border-accent font-medium" : "border-transparent text-muted"}`}>
            Terbaru
          </Link>
          <Link href={href({ urut: "populer" })} className={`-mb-px border-b-2 py-2 ${urut === "populer" ? "border-accent font-medium" : "border-transparent text-muted"}`}>
            Populer 30 hari
          </Link>
          {tag && (
            <Link href={href({ tag: null })} className="ml-auto text-muted hover:underline">
              Hapus filter #{tag.name} ✕
            </Link>
          )}
        </div>

        {list.length === 0 ? (
          <p className="mt-8 text-muted">Belum ada tulisan untuk pilihan ini.</p>
        ) : (
          <div className="divide-y divide-border">
            {list.map((p) => (
              <PostCard key={p.id} post={p} counts={counts.get(p.id)} />
            ))}
          </div>
        )}
      </div>

      <aside className="space-y-10">
        <section>
          <h2 className="mb-3 text-sm font-semibold tracking-wide text-muted uppercase">Publikasi</h2>
          <ul className="space-y-3">
            {topPubs.map((p) => (
              <li key={p.slug}>
                <Link href={`/@${p.slug}`} className="group flex items-center gap-3">
                  <Avatar name={p.name} image={p.logoUrl} size={36} />
                  <span className="min-w-0">
                    <span className="block truncate font-medium group-hover:underline">{p.name}</span>
                    <span className="block truncate text-xs text-muted">{p.subs} pelanggan</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
        {topTags.length > 0 && (
          <section>
            <h2 className="mb-3 text-sm font-semibold tracking-wide text-muted uppercase">Tag</h2>
            <div className="flex flex-wrap gap-2">
              {topTags.map((t) => (
                <Link key={t.slug} href={href({ tag: t.slug })} className={chip(tagSlug === t.slug)}>
                  #{t.name}
                </Link>
              ))}
            </div>
          </section>
        )}
      </aside>
    </main>
  );
}
