import type { Metadata } from "next";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { eq, sql } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BookmarkButton, LikeButton, ReportButton, ShareButton, SubscribeForm } from "@/components/actions";
import { Avatar } from "@/components/ui";
import { getDb, schema } from "@/db";
import { getSession } from "@/lib/auth";
import { CATEGORY_LABEL, isCategory } from "@/lib/categories";
import { contentToText, readingMinutes } from "@/lib/content";
import { formatDate } from "@/lib/format";
import {
  canManagePublication,
  getComments,
  getMembership,
  getLikeCounts,
  getLikedIds,
  getPostTags,
  getPublishedPost,
  isBookmarked,
  isSubscribed,
} from "@/server/queries";
import { Comments } from "./comments";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/pub/[slug]/p/[post]">): Promise<Metadata> {
  const { slug, post: postSlug } = await params;
  const row = await getPublishedPost(slug, postSlug);
  if (!row) return { title: "Tidak ditemukan" };
  const { post, pub, author } = row;
  const description = post.subtitle ?? post.excerpt ?? undefined;
  return {
    title: post.title,
    description,
    authors: [{ name: author.name }],
    alternates: { canonical: `/@${pub.slug}/p/${post.slug}` },
    openGraph: {
      type: "article",
      title: post.title,
      description,
      siteName: pub.name,
      publishedTime: post.publishedAt?.toISOString(),
      images: post.coverUrl ? [post.coverUrl] : pub.logoUrl ? [pub.logoUrl] : undefined,
    },
    twitter: { card: post.coverUrl ? "summary_large_image" : "summary" },
  };
}

export default async function ArticlePage({ params }: PageProps<"/pub/[slug]/p/[post]">) {
  const { slug, post: postSlug } = await params;
  const row = await getPublishedPost(slug, postSlug);
  if (!row) notFound();
  const { post, pub, author } = row;
  const session = await getSession();
  const viewer = session?.user;

  const [tags, liked, likeCounts, saved, subscribed, comments] = await Promise.all([
    getPostTags(post.id),
    getLikedIds(viewer?.id, "post", [post.id]),
    getLikeCounts("post", [post.id]),
    isBookmarked(viewer?.id, post.id),
    isSubscribed(pub.id, viewer?.email),
    getComments(post.id),
  ]);
  const canModerate = viewer ? canManagePublication(await getMembership(pub.id, viewer.id)) : false;
  const commentLikes = await getLikedIds(
    viewer?.id,
    "comment",
    comments.map((c) => c.id),
  );
  const commentLikeCounts = await getLikeCounts(
    "comment",
    comments.map((c) => c.id),
  );

  // Hitung pembaca di background (penulis sendiri tidak dihitung).
  if (viewer?.id !== author.id) {
    getCloudflareContext().ctx.waitUntil(
      getDb()
        .update(schema.posts)
        .set({ viewCount: sql`${schema.posts.viewCount} + 1` })
        .where(eq(schema.posts.id, post.id))
        .then(() => undefined)
        .catch(() => undefined),
    );
  }

  const minutes = readingMinutes(contentToText(post.contentJson));
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    datePublished: post.publishedAt?.toISOString(),
    dateModified: post.updatedAt.toISOString(),
    author: { "@type": "Person", name: author.name },
    publisher: { "@type": "Organization", name: pub.name },
    image: post.coverUrl ?? undefined,
  };

  return (
    <main className="flex-1">
      <article className="mx-auto max-w-[680px] px-4 pt-10 pb-16">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />

        <Link href={`/@${pub.slug}`} className="text-sm font-medium text-accent hover:underline">
          {pub.name}
        </Link>
        <h1 dir="auto" className="mt-3 font-serif text-4xl leading-tight font-semibold sm:text-[2.6rem]">
          {post.title}
        </h1>
        {post.subtitle && (
          <p dir="auto" className="mt-3 font-serif text-xl text-muted">
            {post.subtitle}
          </p>
        )}

        <div className="mt-6 flex items-center gap-3 border-y border-border py-4">
          <Avatar name={author.name} image={author.image} size={40} />
          <div className="min-w-0 text-sm">
            {author.username ? (
              <Link href={`/u/${author.username}`} className="font-medium hover:underline">
                {author.name}
              </Link>
            ) : (
              <span className="font-medium">{author.name}</span>
            )}
            <p className="text-muted">
              {formatDate(post.publishedAt)} · {minutes} menit baca
              {isCategory(post.category) && (
                <>
                  {" · "}
                  <Link href={`/jelajah?kategori=${post.category}`} className="hover:underline">
                    {CATEGORY_LABEL[post.category]}
                  </Link>
                </>
              )}
            </p>
          </div>
        </div>

        {post.coverUrl && (
          // eslint-disable-next-line @next/next/no-img-element -- cover dari R2
          <img src={post.coverUrl} alt="" className="mt-8 w-full rounded-lg" />
        )}

        {/* contentHtml dibuat oleh renderer whitelist di src/lib/content.ts (semua teks di-escape). */}
        <div className="prose-content mt-8" dangerouslySetInnerHTML={{ __html: post.contentHtml ?? "" }} />

        {tags.length > 0 && (
          <ul className="mt-10 flex flex-wrap gap-2">
            {tags.map((t) => (
              <li key={t.slug}>
                <Link
                  href={`/jelajah?tag=${t.slug}`}
                  className="rounded-full bg-foreground/5 px-3 py-1 text-sm text-muted hover:text-foreground"
                >
                  #{t.name}
                </Link>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-8 flex flex-wrap items-center gap-2">
          <LikeButton targetType="post" targetId={post.id} liked={liked.has(post.id)} count={likeCounts.get(post.id) ?? 0} />
          <BookmarkButton postId={post.id} saved={saved} />
          <ShareButton title={post.title} />
          <span className="ml-auto">{viewer && <ReportButton targetType="post" targetId={post.id} />}</span>
        </div>

        <section className="mt-12 rounded-lg border border-border p-6 text-center">
          <p className="mb-4 font-serif text-lg">
            {subscribed ? `Terima kasih telah berlangganan ${pub.name}.` : `Dapatkan tulisan baru dari ${pub.name} lewat email.`}
          </p>
          <SubscribeForm publicationId={pub.id} pubName={pub.name} loggedIn={Boolean(viewer)} subscribed={subscribed} />
          {pub.supportUrl && (
            <a
              href={pub.supportUrl}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="mt-4 inline-block text-sm font-medium text-accent hover:underline"
            >
              Dukung {pub.name} →
            </a>
          )}
        </section>

        <Comments
          postId={post.id}
          comments={comments.map((c) => ({
            ...c,
            liked: commentLikes.has(c.id),
            likes: commentLikeCounts.get(c.id) ?? 0,
          }))}
          viewer={viewer ? { id: viewer.id, role: viewer.role ?? "user" } : null}
          canModerate={canModerate}
        />
      </article>
    </main>
  );
}
