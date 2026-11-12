import type { Metadata } from "next";
import { and, desc, eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb, schema } from "@/db";
import { getPublicationBySlug } from "@/server/queries";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/pub/[slug]/arsip">): Promise<Metadata> {
  const { slug } = await params;
  const row = await getPublicationBySlug(slug);
  return { title: row ? `Arsip ${row.publication.name}` : "Tidak ditemukan" };
}

const monthFmt = new Intl.DateTimeFormat("id-ID", { month: "long", year: "numeric" });
const dayFmt = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short" });

export default async function ArchivePage({ params }: PageProps<"/pub/[slug]/arsip">) {
  const { slug } = await params;
  const row = await getPublicationBySlug(slug);
  if (!row) notFound();
  const pub = row.publication;

  // Arsip hanya judul + tanggal, jadi cukup ringan untuk ditarik sekaligus.
  const list = await getDb()
    .select({ slug: schema.posts.slug, title: schema.posts.title, publishedAt: schema.posts.publishedAt })
    .from(schema.posts)
    .where(and(eq(schema.posts.publicationId, pub.id), eq(schema.posts.status, "published")))
    .orderBy(desc(schema.posts.publishedAt))
    .limit(2000);

  const groups = new Map<string, typeof list>();
  for (const p of list) {
    const key = p.publishedAt ? monthFmt.format(p.publishedAt) : "Tanpa tanggal";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(p);
  }

  return (
    <main className="mx-auto w-full max-w-[680px] flex-1 px-4 py-12">
      <Link href={`/@${pub.slug}`} className="text-sm text-muted hover:underline">
        ← {pub.name}
      </Link>
      <h1 className="mt-3 mb-8 font-serif text-3xl font-semibold">Arsip</h1>
      {list.length === 0 ? (
        <p className="text-muted">Belum ada tulisan.</p>
      ) : (
        <div className="space-y-10">
          {[...groups.entries()].map(([month, items]) => (
            <section key={month}>
              <h2 className="mb-3 text-sm font-semibold tracking-wide text-muted uppercase">{month}</h2>
              <ul className="space-y-2">
                {items.map((p) => (
                  <li key={p.slug} className="flex gap-4">
                    <span className="w-16 shrink-0 text-sm text-muted">{p.publishedAt ? dayFmt.format(p.publishedAt) : ""}</span>
                    <Link href={`/@${pub.slug}/p/${p.slug}`} dir="auto" className="font-serif text-lg hover:underline">
                      {p.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </main>
  );
}
