import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { UnsubscribeForm } from "./unsubscribe-form";

export const metadata: Metadata = { title: "Berhenti berlangganan", robots: { index: false } };
export const dynamic = "force-dynamic";

// GET hanya menampilkan konfirmasi; berhenti dilakukan lewat tombol (POST),
// agar pemindai tautan di klien email tidak memberhentikan langganan secara tidak sengaja.
export default async function UnsubscribePage({ searchParams }: PageProps<"/berhenti">) {
  const { t } = await searchParams;
  const token = typeof t === "string" && /^[0-9a-f]{64}$/.test(t) ? t : null;
  const sub = token
    ? await getDb()
        .select({ name: schema.publications.name, status: schema.subscriptions.status })
        .from(schema.subscriptions)
        .innerJoin(schema.publications, eq(schema.publications.id, schema.subscriptions.publicationId))
        .where(eq(schema.subscriptions.token, token))
        .get()
    : undefined;

  return (
    <main className="mx-auto w-full max-w-md flex-1 px-4 py-20 text-center">
      {!sub || !token ? (
        <>
          <h1 className="font-serif text-3xl font-semibold">Tautan tidak valid</h1>
          <p className="mt-3 text-muted">Tautan berhenti berlangganan salah atau sudah tidak berlaku.</p>
        </>
      ) : sub.status === "unsubscribed" ? (
        <>
          <h1 className="font-serif text-3xl font-semibold">Sudah berhenti</h1>
          <p className="mt-3 text-muted">Anda tidak lagi menerima email dari {sub.name}.</p>
        </>
      ) : (
        <>
          <h1 className="font-serif text-3xl font-semibold">Berhenti berlangganan?</h1>
          <p className="mt-3 mb-6 text-muted">Anda tidak akan lagi menerima email dari {sub.name}.</p>
          <UnsubscribeForm token={token} />
        </>
      )}
    </main>
  );
}
