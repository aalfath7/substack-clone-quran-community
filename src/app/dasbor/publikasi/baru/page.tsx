import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { createPublication } from "@/server/publications";
import { PublicationForm } from "../../publication-form";

export const metadata: Metadata = { title: "Buat publikasi" };
export const dynamic = "force-dynamic";

export default async function NewPublicationPage() {
  await requireUser("/dasbor/publikasi/baru");

  return (
    <main className="mx-auto w-full max-w-xl flex-1 px-4 py-12">
      <Link href="/dasbor" className="text-sm text-muted hover:underline">
        ← Dasbor
      </Link>
      <h1 className="mt-4 mb-1 font-serif text-3xl font-semibold">Buat publikasi</h1>
      <p className="mb-8 text-muted">Tempat tulisan Anda terbit dan pembaca berlangganan.</p>
      <PublicationForm action={createPublication} submitLabel="Buat publikasi" />
    </main>
  );
}
