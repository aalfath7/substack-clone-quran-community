import type { Metadata } from "next";
import { and, count, desc, eq, gt, sql, sum } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb, schema } from "@/db";
import { requireUser } from "@/lib/auth";
import { daysAgo, formatDate } from "@/lib/format";
import { canManagePublication, getMembership, getPostCounts } from "@/server/queries";

export const metadata: Metadata = { title: "Statistik" };
export const dynamic = "force-dynamic";

export default async function StatsPage({ params }: PageProps<"/dasbor/publikasi/[id]/statistik">) {
  const { id } = await params;
  const user = await requireUser(`/dasbor/publikasi/${id}/statistik`);
  if (!canManagePublication(await getMembership(id, user.id))) notFound();

  const { posts, subscriptions, publications } = schema;
  const db = getDb();
  const since30 = daysAgo(30);
  const day = sql<string>`date(${subscriptions.createdAt} / 1000, 'unixepoch')`;

  const [[subs], [newSubs], [views], top, daily, pub] = await Promise.all([
    db
      .select({ n: count() })
      .from(subscriptions)
      .where(and(eq(subscriptions.publicationId, id), eq(subscriptions.status, "active"))),
    db
      .select({ n: count() })
      .from(subscriptions)
      .where(and(eq(subscriptions.publicationId, id), eq(subscriptions.status, "active"), gt(subscriptions.createdAt, since30))),
    db.select({ n: sum(posts.viewCount) }).from(posts).where(eq(posts.publicationId, id)),
    db
      .select({ id: posts.id, title: posts.title, slug: posts.slug, publishedAt: posts.publishedAt, views: posts.viewCount })
      .from(posts)
      .where(and(eq(posts.publicationId, id), eq(posts.status, "published")))
      .orderBy(desc(posts.viewCount))
      .limit(20),
    // Pendaftar per hari (30 hari terakhir); created_at disimpan sebagai epoch ms.
    db
      .select({ day, n: count() })
      .from(subscriptions)
      .where(and(eq(subscriptions.publicationId, id), gt(subscriptions.createdAt, since30)))
      .groupBy(day)
      .orderBy(day),
    db.select({ slug: publications.slug }).from(publications).where(eq(publications.id, id)).get(),
  ]);
  const counts = await getPostCounts(top.map((p) => p.id));

  const max = Math.max(1, ...daily.map((d) => d.n));
  const cards = [
    { label: "Pelanggan aktif", value: subs.n },
    { label: "Pelanggan baru (30 hari)", value: newSubs.n },
    { label: "Total dibaca", value: Number(views.n ?? 0) },
  ];

  return (
    <div className="space-y-10">
      <div className="grid gap-4 sm:grid-cols-3">
        {cards.map((c) => (
          <div key={c.label} className="rounded-lg border border-border p-4">
            <p className="text-sm text-muted">{c.label}</p>
            <p className="mt-1 text-3xl font-semibold tabular-nums">{c.value.toLocaleString("id-ID")}</p>
          </div>
        ))}
      </div>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Pendaftar 30 hari terakhir</h2>
        {daily.length === 0 ? (
          <p className="text-muted">Belum ada pendaftar dalam 30 hari terakhir.</p>
        ) : (
          <ul className="space-y-1" aria-label="Pendaftar per hari">
            {daily.map((d) => (
              <li key={d.day} className="flex items-center gap-3 text-sm">
                <span className="w-24 shrink-0 text-muted tabular-nums">{d.day}</span>
                <span className="h-3 rounded-sm bg-accent" style={{ width: `${(d.n / max) * 70}%`, minWidth: 4 }} />
                <span className="tabular-nums">{d.n}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Tulisan</h2>
        {top.length === 0 ? (
          <p className="text-muted">Belum ada tulisan terbit.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-left text-sm">
              <thead className="bg-foreground/5 text-muted">
                <tr>
                  <th className="px-4 py-2 font-medium">Judul</th>
                  <th className="px-4 py-2 text-right font-medium">Dibaca</th>
                  <th className="px-4 py-2 text-right font-medium">Suka</th>
                  <th className="px-4 py-2 text-right font-medium">Komentar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {top.map((p) => (
                  <tr key={p.id}>
                    <td className="px-4 py-2">
                      <Link href={`/@${pub?.slug}/p/${p.slug}`} className="hover:underline">
                        {p.title}
                      </Link>
                      <span className="block text-xs text-muted">{formatDate(p.publishedAt)}</span>
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">{p.views}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{counts.get(p.id)?.likes ?? 0}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{counts.get(p.id)?.comments ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-2 text-xs text-muted">Jumlah dibaca menghitung setiap kunjungan halaman, kecuali oleh penulisnya sendiri.</p>
      </section>
    </div>
  );
}
