import type { Metadata } from "next";
import { and, eq } from "drizzle-orm";
import Link from "next/link";
import { getDb, schema } from "@/db";

export const metadata: Metadata = { title: "Konfirmasi langganan", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function ConfirmPage({ searchParams }: PageProps<"/konfirmasi">) {
  const { t } = await searchParams;
  const token = typeof t === "string" && /^[0-9a-f]{64}$/.test(t) ? t : null;

  let pub: { name: string; slug: string } | undefined;
  if (token) {
    const { subscriptions, publications } = schema;
    const db = getDb();
    const sub = await db
      .select({ id: subscriptions.id, status: subscriptions.status, name: publications.name, slug: publications.slug })
      .from(subscriptions)
      .innerJoin(publications, eq(publications.id, subscriptions.publicationId))
      .where(eq(subscriptions.token, token))
      .get();
    if (sub) {
      // Hanya "pending" yang diaktifkan; yang sudah berhenti tidak dihidupkan ulang lewat tautan lama.
      if (sub.status === "pending") {
        await db
          .update(subscriptions)
          .set({ status: "active" })
          .where(and(eq(subscriptions.id, sub.id), eq(subscriptions.status, "pending")));
      }
      if (sub.status !== "unsubscribed") pub = { name: sub.name, slug: sub.slug };
    }
  }

  return (
    <main className="mx-auto w-full max-w-md flex-1 px-4 py-20 text-center">
      {pub ? (
        <>
          <h1 className="font-serif text-3xl font-semibold">Langganan aktif</h1>
          <p className="mt-3 text-muted">Tulisan baru dari {pub.name} akan dikirim ke email Anda.</p>
          <Link href={`/@${pub.slug}`} className="mt-6 inline-block font-medium text-accent hover:underline">
            Kunjungi {pub.name} →
          </Link>
        </>
      ) : (
        <>
          <h1 className="font-serif text-3xl font-semibold">Tautan tidak valid</h1>
          <p className="mt-3 text-muted">Tautan konfirmasi salah atau sudah tidak berlaku.</p>
        </>
      )}
    </main>
  );
}
