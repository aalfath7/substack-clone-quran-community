import type { Metadata } from "next";
import Link from "next/link";
import { NoteCard, NoteComposer } from "@/components/notes";
import { getSession } from "@/lib/auth";
import { getNotes, withNoteLikes } from "@/server/queries";

export const metadata: Metadata = { title: "Catatan", description: "Renungan singkat dari komunitas." };
export const dynamic = "force-dynamic";

const PAGE = 30;

export default async function NotesPage({ searchParams }: PageProps<"/catatan">) {
  const { sebelum } = await searchParams;
  const before = typeof sebelum === "string" && /^\d+$/.test(sebelum) ? new Date(Number(sebelum)) : undefined;
  const session = await getSession();
  const list = await getNotes({ before, limit: PAGE + 1 });
  const items = await withNoteLikes(list.slice(0, PAGE), session?.user.id);
  const last = items.at(-1)?.createdAt;

  return (
    <main className="mx-auto w-full max-w-[680px] flex-1 px-4 py-12">
      <h1 className="font-serif text-3xl font-semibold">Catatan</h1>
      <p className="mt-1 mb-6 text-muted">Renungan singkat dari komunitas.</p>
      {session ? (
        <NoteComposer />
      ) : (
        <p className="rounded-md bg-foreground/5 p-4 text-sm">
          <Link href="/masuk?next=/catatan" className="font-medium text-accent hover:underline">
            Masuk
          </Link>{" "}
          untuk menulis catatan.
        </p>
      )}
      <div className="mt-4 divide-y divide-border">
        {items.map((n) => (
          <NoteCard key={n.id} note={n} viewerId={session?.user.id} viewerIsAdmin={session?.user.role === "admin"} />
        ))}
      </div>
      {items.length === 0 && <p className="mt-6 text-muted">Belum ada catatan.</p>}
      {list.length > PAGE && last && (
        <Link href={`/catatan?sebelum=${last.getTime()}`} className="mt-4 inline-block text-sm font-medium text-accent hover:underline">
          Catatan lebih lama →
        </Link>
      )}
    </main>
  );
}
