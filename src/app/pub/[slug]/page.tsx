import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SubscribeForm } from "@/components/actions";
import { PostCard } from "@/components/post-card";
import { Avatar } from "@/components/ui";
import { getSession } from "@/lib/auth";
import {
  getPostCounts,
  getPublicationBySlug,
  getPublishedPostsOfPublication,
  getRecommendations,
  getSubscriberCount,
  isSubscribed,
} from "@/server/queries";

// Diakses lewat /@slug (rewrite di next.config.ts).
export const dynamic = "force-dynamic";

const PAGE = 10;

export async function generateMetadata({ params }: PageProps<"/pub/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const row = await getPublicationBySlug(slug);
  if (!row) return { title: "Tidak ditemukan" };
  const p = row.publication;
  return {
    title: p.name,
    description: p.tagline ?? p.description ?? undefined,
    alternates: { canonical: `/@${p.slug}` },
    openGraph: { title: p.name, description: p.tagline ?? undefined, images: p.logoUrl ? [p.logoUrl] : undefined },
  };
}

export default async function PublicationPage({ params, searchParams }: PageProps<"/pub/[slug]">) {
  const { slug } = await params;
  const { sebelum } = await searchParams;
  const row = await getPublicationBySlug(slug);
  if (!row) notFound();
  const { publication: pub, owner } = row;

  const before = typeof sebelum === "string" && /^\d+$/.test(sebelum) ? new Date(Number(sebelum)) : undefined;
  const session = await getSession();
  const [list, subscribed, subscriberCount, recs] = await Promise.all([
    getPublishedPostsOfPublication(pub.id, before, PAGE + 1),
    isSubscribed(pub.id, session?.user.email),
    getSubscriberCount(pub.id),
    getRecommendations(pub.id),
  ]);
  const hasMore = list.length > PAGE;
  const items = list.slice(0, PAGE);
  const counts = await getPostCounts(items.map((p) => p.id));
  const last = items.at(-1)?.publishedAt;

  return (
    <main className="flex-1">
      <section className="border-b border-border">
        <div className="mx-auto max-w-[680px] px-4 py-14 text-center">
          {pub.logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element -- logo dari R2
            <img src={pub.logoUrl} alt="" className="mx-auto mb-5 h-20 w-20 rounded-full object-cover" />
          )}
          <h1 dir="auto" className="font-serif text-4xl font-semibold sm:text-5xl">
            {pub.name}
          </h1>
          {pub.tagline && (
            <p dir="auto" className="mt-4 text-lg text-muted">
              {pub.tagline}
            </p>
          )}
          {owner.username && (
            <Link
              href={`/u/${owner.username}`}
              className="mt-5 inline-flex items-center gap-2 text-sm text-muted hover:text-foreground"
            >
              <Avatar name={owner.name} image={owner.image} size={24} />
              oleh {owner.name}
            </Link>
          )}
          <p className="mt-2 text-sm text-muted">{subscriberCount} pelanggan</p>

          <div className="mt-6">
            <SubscribeForm
              publicationId={pub.id}
              pubName={pub.name}
              loggedIn={Boolean(session)}
              subscribed={subscribed}
            />
          </div>

          {pub.supportUrl && (
            <div className="mt-6 rounded-lg border border-border p-4 text-sm">
              {pub.supportText && <p className="mb-2 text-muted">{pub.supportText}</p>}
              <a
                href={pub.supportUrl}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="font-medium text-accent hover:underline"
              >
                Dukung publikasi ini →
              </a>
            </div>
          )}
        </div>
      </section>

      <div className="mx-auto grid max-w-5xl gap-12 px-4 py-10 lg:grid-cols-[1fr_260px]">
        <section className="min-w-0">
          <div className="flex items-baseline justify-between">
            <h2 className="text-sm font-semibold tracking-wide text-muted uppercase">
              {before ? "Tulisan sebelumnya" : "Tulisan terbaru"}
            </h2>
            <Link href={`/@${pub.slug}/arsip`} className="text-sm text-accent hover:underline">
              Arsip
            </Link>
          </div>
          {items.length === 0 ? (
            <p className="mt-6 text-muted">Belum ada tulisan.</p>
          ) : (
            <div className="divide-y divide-border">
              {items.map((p) => (
                <PostCard key={p.id} post={p} counts={counts.get(p.id)} showPublication={false} />
              ))}
            </div>
          )}
          {hasMore && last && (
            <Link
              href={`/@${pub.slug}?sebelum=${last.getTime()}`}
              className="mt-4 inline-block text-sm font-medium text-accent hover:underline"
            >
              Tulisan lebih lama →
            </Link>
          )}
        </section>

        <aside className="space-y-10">
          {pub.description && (
            <section>
              <h2 className="mb-3 text-sm font-semibold tracking-wide text-muted uppercase">Tentang</h2>
              <p dir="auto" className="font-serif leading-7 whitespace-pre-line">
                {pub.description}
              </p>
            </section>
          )}
          {recs.length > 0 && (
            <section>
              <h2 className="mb-3 text-sm font-semibold tracking-wide text-muted uppercase">Rekomendasi</h2>
              <ul className="space-y-3">
                {recs.map((r) => (
                  <li key={r.slug}>
                    <Link href={`/@${r.slug}`} className="group flex items-center gap-3">
                      <Avatar name={r.name} image={r.logoUrl} size={36} />
                      <span className="min-w-0">
                        <span className="block truncate font-medium group-hover:underline">{r.name}</span>
                        {r.tagline && <span className="block truncate text-xs text-muted">{r.tagline}</span>}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </aside>
      </div>
    </main>
  );
}
