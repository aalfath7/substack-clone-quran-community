import type { Metadata } from "next";
import { count, desc, eq, inArray } from "drizzle-orm";
import Link from "next/link";
import { Button } from "@/components/ui";
import { getDb, schema } from "@/db";
import { timeAgo } from "@/lib/format";
import { requireAdmin } from "@/lib/auth";
import { resolveReport } from "@/server/admin";

export const metadata: Metadata = { title: "Admin", robots: { index: false } };
export const dynamic = "force-dynamic";

const TYPE_LABEL = { post: "Tulisan", comment: "Komentar", note: "Catatan" } as const;

export default async function AdminPage() {
  await requireAdmin();
  const { reports, users, posts, publications, comments, notes } = schema;
  const db = getDb();

  const [open, stats] = await Promise.all([
    db
      .select({
        id: reports.id,
        targetType: reports.targetType,
        targetId: reports.targetId,
        reason: reports.reason,
        createdAt: reports.createdAt,
        reporter: users.name,
      })
      .from(reports)
      .innerJoin(users, eq(users.id, reports.reporterId))
      .where(eq(reports.status, "open"))
      .orderBy(desc(reports.createdAt))
      .limit(100),
    Promise.all([
      db.select({ n: count() }).from(users),
      db.select({ n: count() }).from(publications),
      db.select({ n: count() }).from(posts).where(eq(posts.status, "published")),
    ]),
  ]);

  // Pratinjau konten yang dilaporkan.
  const ids = (t: "post" | "comment" | "note") => open.filter((r) => r.targetType === t).map((r) => r.targetId);
  const [postRows, commentRows, noteRows] = await Promise.all([
    ids("post").length
      ? db
          .select({ id: posts.id, text: posts.title, slug: posts.slug, pubSlug: publications.slug, status: posts.status })
          .from(posts)
          .innerJoin(publications, eq(publications.id, posts.publicationId))
          .where(inArray(posts.id, ids("post")))
      : [],
    ids("comment").length
      ? db
          .select({ id: comments.id, text: comments.body, slug: posts.slug, pubSlug: publications.slug, deletedAt: comments.deletedAt })
          .from(comments)
          .innerJoin(posts, eq(posts.id, comments.postId))
          .innerJoin(publications, eq(publications.id, posts.publicationId))
          .where(inArray(comments.id, ids("comment")))
      : [],
    ids("note").length
      ? db
          .select({ id: notes.id, text: notes.body, username: users.username, deletedAt: notes.deletedAt })
          .from(notes)
          .innerJoin(users, eq(users.id, notes.authorId))
          .where(inArray(notes.id, ids("note")))
      : [],
  ]);
  const preview = new Map<string, { text: string; href?: string }>();
  for (const p of postRows) preview.set(p.id, { text: p.text, href: p.status === "published" ? `/@${p.pubSlug}/p/${p.slug}` : undefined });
  for (const c of commentRows) preview.set(c.id, { text: c.text, href: `/@${c.pubSlug}/p/${c.slug}#komentar` });
  for (const n of noteRows) preview.set(n.id, { text: n.text, href: n.username ? `/u/${n.username}` : undefined });

  const [[u], [p], [t]] = stats;

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-10">
      <h1 className="font-serif text-3xl font-semibold">Admin</h1>
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        {[
          ["Pengguna", u.n],
          ["Publikasi", p.n],
          ["Tulisan terbit", t.n],
        ].map(([label, n]) => (
          <div key={label} className="rounded-lg border border-border p-4">
            <p className="text-sm text-muted">{label}</p>
            <p className="mt-1 text-3xl font-semibold tabular-nums">{n}</p>
          </div>
        ))}
      </div>

      <h2 className="mt-10 mb-4 text-lg font-semibold">Laporan terbuka ({open.length})</h2>
      {open.length === 0 ? (
        <p className="text-muted">Tidak ada laporan. Alhamdulillah.</p>
      ) : (
        <ul className="space-y-4">
          {open.map((r) => {
            const pv = preview.get(r.targetId);
            return (
              <li key={r.id} className="rounded-lg border border-border p-4">
                <p className="text-xs text-muted">
                  {TYPE_LABEL[r.targetType]} · dilaporkan {r.reporter} · {timeAgo(r.createdAt)}
                </p>
                <p className="mt-2 text-sm">
                  <span className="font-medium">Alasan:</span> {r.reason}
                </p>
                <blockquote dir="auto" className="mt-2 line-clamp-4 border-l-2 border-border pl-3 text-sm whitespace-pre-line text-muted">
                  {pv?.text ?? "(konten sudah tidak ada)"}
                </blockquote>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {pv?.href && (
                    <Link href={pv.href} target="_blank" className="text-sm text-accent hover:underline">
                      Buka konten
                    </Link>
                  )}
                  <form action={resolveReport.bind(null, r.id, "hide")} className="ml-auto">
                    <Button type="submit" className="bg-red-600 text-white">
                      Sembunyikan konten
                    </Button>
                  </form>
                  <form action={resolveReport.bind(null, r.id, "dismiss")}>
                    <Button type="submit" variant="secondary">
                      Abaikan
                    </Button>
                  </form>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
