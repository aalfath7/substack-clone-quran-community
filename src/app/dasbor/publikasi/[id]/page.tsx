import type { Metadata } from "next";
import Link from "next/link";
import { Button, FormMessage } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { createDraft } from "@/server/posts";
import { getDashboardPosts, getMembership, getPublicationById } from "@/server/queries";

export const metadata: Metadata = { title: "Tulisan" };
export const dynamic = "force-dynamic";

const date = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", year: "numeric" });

export default async function PublicationPostsPage({ params, searchParams }: PageProps<"/dasbor/publikasi/[id]">) {
  const { id } = await params;
  const { baru } = await searchParams;
  const user = await requireUser(`/dasbor/publikasi/${id}`);
  const [role, pub, all] = await Promise.all([getMembership(id, user.id), getPublicationById(id), getDashboardPosts(id)]);
  if (!pub) return null;

  // Penulis (writer) hanya melihat tulisannya sendiri.
  const list = role === "writer" ? all.filter((p) => p.authorId === user.id) : all;
  const drafts = list.filter((p) => p.status !== "published");
  const published = list.filter((p) => p.status === "published");

  return (
    <div className="space-y-10">
      {baru && <FormMessage ok>Publikasi berhasil dibuat. Mulai tulisan pertama Anda.</FormMessage>}

      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Tulisan</h2>
        <form action={createDraft.bind(null, id)}>
          <Button type="submit">Tulisan baru</Button>
        </form>
      </div>

      <Section title={`Draf (${drafts.length})`} empty="Tidak ada draf.">
        {drafts.map((p) => (
          <Row
            key={p.id}
            href={`/dasbor/tulisan/${p.id}`}
            title={p.title || "Tanpa judul"}
            meta={`Diubah ${date.format(p.updatedAt)} · ${p.authorName}`}
          />
        ))}
      </Section>

      <Section title={`Terbit (${published.length})`} empty="Belum ada tulisan terbit.">
        {published.map((p) => (
          <Row
            key={p.id}
            href={`/dasbor/tulisan/${p.id}`}
            title={p.title}
            meta={`${p.publishedAt ? date.format(p.publishedAt) : ""} · ${p.viewCount} kali dibaca${p.emailedAt ? " · terkirim via email" : ""}`}
            publicHref={`/@${pub.slug}/p/${p.slug}`}
          />
        ))}
      </Section>
    </div>
  );
}

function Section({ title, empty, children }: { title: string; empty: string; children: React.ReactNode[] }) {
  return (
    <section>
      <h3 className="mb-2 text-sm font-semibold tracking-wide text-muted uppercase">{title}</h3>
      {children.length === 0 ? (
        <p className="text-muted">{empty}</p>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border">{children}</ul>
      )}
    </section>
  );
}

function Row({ href, title, meta, publicHref }: { href: string; title: string; meta: string; publicHref?: string }) {
  return (
    <li className="flex items-center justify-between gap-3 p-4">
      <Link href={href} className="min-w-0 hover:opacity-80">
        <p className="truncate font-medium">{title}</p>
        <p className="text-sm text-muted">{meta}</p>
      </Link>
      {publicHref && (
        <Link href={publicHref} className="shrink-0 text-sm text-accent hover:underline">
          Lihat
        </Link>
      )}
    </li>
  );
}
