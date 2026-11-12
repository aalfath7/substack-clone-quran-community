import Link from "next/link";
import { NoteCard, NoteComposer, type NoteView } from "@/components/notes";
import { PostCard } from "@/components/post-card";
import { buttonClass } from "@/components/ui";
import { getSession } from "@/lib/auth";
import { CATEGORY_LABEL, POST_CATEGORIES } from "@/lib/categories";
import { getFeedSources, getLatestPosts, getNotes, getPostCounts, withNoteLikes, type PostCard as PostCardData } from "@/server/queries";

export const dynamic = "force-dynamic";

export default async function Home() {
  const session = await getSession();
  return session ? <Feed userId={session.user.id} email={session.user.email} isAdmin={session.user.role === "admin"} /> : <Landing />;
}

async function Landing() {
  const latest = await getLatestPosts({ limit: 6 });
  const counts = await getPostCounts(latest.map((p) => p.id));
  return (
    <>
      <section className="border-b border-border">
        <div className="mx-auto max-w-[680px] px-4 py-20">
          <h1 className="font-serif text-4xl leading-tight font-semibold sm:text-5xl">
            Menulis dan berbagi renungan Al-Qur&apos;an.
          </h1>
          <p className="mt-5 text-lg leading-8 text-muted">
            Buat publikasi sendiri, terbitkan tadabbur, kajian, dan catatan hafalan, lalu kirim langsung ke pembaca yang
            berlangganan.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/daftar?next=/dasbor/publikasi/baru" className={buttonClass("primary", "px-5 py-2.5 text-base")}>
              Mulai menulis
            </Link>
            <Link href="/jelajah" className={buttonClass("secondary", "px-5 py-2.5 text-base")}>
              Jelajahi tulisan
            </Link>
          </div>
          <ul className="mt-10 flex flex-wrap gap-2">
            {POST_CATEGORIES.map((c) => (
              <li key={c}>
                <Link
                  href={`/jelajah?kategori=${c}`}
                  className="rounded-full border border-border px-3 py-1 text-sm text-muted hover:text-foreground"
                >
                  {CATEGORY_LABEL[c]}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>
      {latest.length > 0 && (
        <section className="mx-auto w-full max-w-[680px] px-4 py-12">
          <h2 className="text-sm font-semibold tracking-wide text-muted uppercase">Tulisan terbaru</h2>
          <div className="divide-y divide-border">
            {latest.map((p) => (
              <PostCard key={p.id} post={p} counts={counts.get(p.id)} />
            ))}
          </div>
        </section>
      )}
    </>
  );
}

type FeedItem = { kind: "post"; at: number; post: PostCardData } | { kind: "note"; at: number; note: NoteView };

async function Feed({ userId, email, isAdmin }: { userId: string; email: string; isAdmin: boolean }) {
  const { publicationIds, followingIds } = await getFeedSources(userId, email);
  const [posts, rawNotes] = await Promise.all([
    getLatestPosts({ publicationIds, limit: 20 }),
    getNotes({ authorIds: [...followingIds, userId], limit: 20 }),
  ]);
  const [counts, notes] = await Promise.all([getPostCounts(posts.map((p) => p.id)), withNoteLikes(rawNotes, userId)]);

  const items: FeedItem[] = [
    ...posts.map((post) => ({ kind: "post" as const, at: post.publishedAt?.getTime() ?? 0, post })),
    ...notes.map((note) => ({ kind: "note" as const, at: note.createdAt.getTime(), note })),
  ].sort((a, b) => b.at - a.at);

  const empty = publicationIds.length === 0 && followingIds.length === 0;

  return (
    <main className="mx-auto w-full max-w-[680px] flex-1 px-4 py-10">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-serif text-3xl font-semibold">Beranda</h1>
        <nav className="flex gap-3 text-sm">
          <Link href="/jelajah" className="text-accent hover:underline">
            Jelajah
          </Link>
          <Link href="/catatan" className="text-accent hover:underline">
            Semua catatan
          </Link>
          <Link href="/tersimpan" className="text-accent hover:underline">
            Tersimpan
          </Link>
        </nav>
      </div>

      <NoteComposer />

      {empty && (
        <div className="mt-6 rounded-lg border border-dashed border-border p-6 text-center">
          <p className="font-medium">Feed Anda masih kosong.</p>
          <p className="mt-1 text-muted">Berlangganan publikasi dan ikuti penulis untuk melihat tulisan mereka di sini.</p>
          <Link href="/jelajah" className={buttonClass("primary", "mt-4")}>
            Cari publikasi
          </Link>
        </div>
      )}

      <div className="mt-4 divide-y divide-border">
        {items.map((it) =>
          it.kind === "post" ? (
            <PostCard key={`p-${it.post.id}`} post={it.post} counts={counts.get(it.post.id)} />
          ) : (
            <NoteCard key={`n-${it.note.id}`} note={it.note} viewerId={userId} viewerIsAdmin={isAdmin} />
          ),
        )}
      </div>
    </main>
  );
}
