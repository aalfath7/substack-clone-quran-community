import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { canManagePublication, getMembership, getPublicationById } from "@/server/queries";
import { PubTabs } from "./tabs";

export default async function PublicationDashboardLayout({
  children,
  params,
}: LayoutProps<"/dasbor/publikasi/[id]">) {
  const { id } = await params;
  const user = await requireUser(`/dasbor/publikasi/${id}`);
  // Bukan anggota: 404 agar keberadaan publikasi tidak bocor.
  const role = await getMembership(id, user.id);
  if (!role) notFound();
  const pub = await getPublicationById(id);
  if (!pub) notFound();

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-10">
      <Link href="/dasbor" className="text-sm text-muted hover:underline">
        ← Dasbor
      </Link>
      <div className="mt-3 mb-6 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate font-serif text-3xl font-semibold">{pub.name}</h1>
          <p className="text-sm text-muted">/@{pub.slug}</p>
        </div>
        <Link href={`/@${pub.slug}`} className="text-sm font-medium text-accent hover:underline">
          Lihat halaman publik →
        </Link>
      </div>
      <PubTabs id={id} canManage={canManagePublication(role)} />
      <div className="pt-8">{children}</div>
    </main>
  );
}
