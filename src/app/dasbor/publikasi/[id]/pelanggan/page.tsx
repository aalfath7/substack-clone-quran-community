import type { Metadata } from "next";
import { count, desc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { getDb, schema } from "@/db";
import { requireUser } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { canManagePublication, getMembership } from "@/server/queries";

export const metadata: Metadata = { title: "Pelanggan" };
export const dynamic = "force-dynamic";

const STATUS = { active: "Aktif", pending: "Menunggu konfirmasi", unsubscribed: "Berhenti" } as const;

export default async function SubscribersPage({ params }: PageProps<"/dasbor/publikasi/[id]/pelanggan">) {
  const { id } = await params;
  const user = await requireUser(`/dasbor/publikasi/${id}/pelanggan`);
  if (!canManagePublication(await getMembership(id, user.id))) notFound();

  const { subscriptions } = schema;
  const db = getDb();
  const [byStatus, list] = await Promise.all([
    db
      .select({ status: subscriptions.status, n: count() })
      .from(subscriptions)
      .where(eq(subscriptions.publicationId, id))
      .groupBy(subscriptions.status),
    db
      .select({
        email: subscriptions.email,
        status: subscriptions.status,
        createdAt: subscriptions.createdAt,
        userId: subscriptions.userId,
      })
      .from(subscriptions)
      .where(eq(subscriptions.publicationId, id))
      .orderBy(desc(subscriptions.createdAt))
      .limit(500),
  ]);
  const total = (s: keyof typeof STATUS) => byStatus.find((b) => b.status === s)?.n ?? 0;

  return (
    <div className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-3">
        {(["active", "pending", "unsubscribed"] as const).map((s) => (
          <div key={s} className="rounded-lg border border-border p-4">
            <p className="text-sm text-muted">{STATUS[s]}</p>
            <p className="mt-1 text-3xl font-semibold tabular-nums">{total(s)}</p>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Daftar pelanggan</h2>
        <a href={`/dasbor/publikasi/${id}/pelanggan.csv`} className="text-sm font-medium text-accent hover:underline">
          Unduh CSV
        </a>
      </div>
      {list.length === 0 ? (
        <p className="text-muted">Belum ada pelanggan. Bagikan halaman publikasi Anda.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-left text-sm">
            <thead className="bg-foreground/5 text-muted">
              <tr>
                <th className="px-4 py-2 font-medium">Email</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium">Sejak</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {list.map((s) => (
                <tr key={s.email}>
                  <td className="px-4 py-2">
                    {s.email} {s.userId && <span className="text-xs text-muted">(akun)</span>}
                  </td>
                  <td className="px-4 py-2">{STATUS[s.status]}</td>
                  <td className="px-4 py-2 whitespace-nowrap text-muted">{formatDate(s.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {list.length === 500 && <p className="text-sm text-muted">Menampilkan 500 terbaru. Unduh CSV untuk daftar lengkap.</p>}
    </div>
  );
}
