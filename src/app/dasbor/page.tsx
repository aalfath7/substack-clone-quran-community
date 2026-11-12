import type { Metadata } from "next";
import Link from "next/link";
import { buttonClass } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { getUserPublications } from "@/server/queries";

export const metadata: Metadata = { title: "Dasbor" };
export const dynamic = "force-dynamic";

const ROLE_LABEL = { owner: "Pemilik", editor: "Editor", writer: "Penulis" } as const;

export default async function DashboardPage() {
  const user = await requireUser("/dasbor");
  const pubs = await getUserPublications(user.id);

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-12">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl font-semibold">Dasbor</h1>
          <p className="text-muted">Assalamu&apos;alaikum, {user.name}.</p>
        </div>
        <Link href="/dasbor/publikasi/baru" className={buttonClass()}>
          Buat publikasi
        </Link>
      </div>

      <h2 className="mb-3 text-sm font-semibold tracking-wide text-muted uppercase">Publikasi Anda</h2>
      {pubs.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-8 text-center">
          <p className="font-medium">Belum ada publikasi.</p>
          <p className="mt-1 text-muted">Buat publikasi untuk mulai menulis dan mengumpulkan pembaca.</p>
        </div>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {pubs.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <p className="truncate font-serif text-lg font-semibold">{p.name}</p>
                <p className="text-sm text-muted">
                  /@{p.slug} · {ROLE_LABEL[p.role]}
                </p>
              </div>
              <div className="flex gap-2">
                <Link href={`/@${p.slug}`} className={buttonClass("ghost")}>
                  Lihat
                </Link>
                {(p.role === "owner" || p.role === "editor") && (
                  <Link href={`/dasbor/publikasi/${p.id}`} className={buttonClass("secondary")}>
                    Pengaturan
                  </Link>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
