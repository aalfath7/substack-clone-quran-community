import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FollowButton } from "@/components/actions";
import { NoteCard } from "@/components/notes";
import { Avatar, buttonClass } from "@/components/ui";
import { getSession } from "@/lib/auth";
import { getFollowInfo, getNotes, getOwnedPublications, getUserByUsername, withNoteLikes } from "@/server/queries";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/u/[username]">): Promise<Metadata> {
  const { username } = await params;
  const user = await getUserByUsername(username);
  if (!user) return { title: "Tidak ditemukan" };
  return { title: `${user.name} (@${user.username})`, description: user.bio ?? undefined };
}

const joined = new Intl.DateTimeFormat("id-ID", { month: "long", year: "numeric" });

export default async function ProfilePage({ params }: PageProps<"/u/[username]">) {
  const { username } = await params;
  const user = await getUserByUsername(username);
  if (!user) notFound();

  const session = await getSession();
  const viewer = session?.user;
  const [pubs, follow, rawNotes] = await Promise.all([
    getOwnedPublications(user.id),
    getFollowInfo(user.id, viewer?.id),
    getNotes({ authorIds: [user.id], limit: 20 }),
  ]);
  const notes = await withNoteLikes(rawNotes, viewer?.id);
  const isMe = viewer?.id === user.id;

  return (
    <main className="mx-auto w-full max-w-[680px] flex-1 px-4 py-12">
      <div className="flex flex-wrap items-center gap-4">
        <Avatar name={user.name} image={user.image} size={72} />
        <div className="min-w-0 flex-1">
          <h1 dir="auto" className="truncate font-serif text-3xl font-semibold">
            {user.name}
          </h1>
          <p className="text-muted">
            @{user.username} · Bergabung {joined.format(user.createdAt)}
          </p>
        </div>
      </div>

      {user.bio && (
        <p dir="auto" className="mt-6 text-lg leading-8 whitespace-pre-line">
          {user.bio}
        </p>
      )}

      <div className="mt-6">
        {isMe ? (
          <div className="flex items-center gap-3">
            <Link href="/pengaturan" className={buttonClass("secondary")}>
              Ubah profil
            </Link>
            <span className="text-sm text-muted">
              {follow.followers} pengikut · {follow.following} mengikuti
            </span>
          </div>
        ) : (
          <FollowButton userId={user.id} following={follow.isFollowing} followers={follow.followers} />
        )}
      </div>

      <section className="mt-12">
        <h2 className="mb-4 text-sm font-semibold tracking-wide text-muted uppercase">Publikasi</h2>
        {pubs.length === 0 ? (
          <p className="text-muted">Belum ada publikasi.</p>
        ) : (
          <ul className="divide-y divide-border border-y border-border">
            {pubs.map((p) => (
              <li key={p.slug}>
                <Link href={`/@${p.slug}`} className="block py-4 hover:opacity-80">
                  <p className="font-serif text-xl font-semibold">{p.name}</p>
                  {p.tagline && <p className="text-muted">{p.tagline}</p>}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-12">
        <h2 className="mb-2 text-sm font-semibold tracking-wide text-muted uppercase">Catatan</h2>
        {notes.length === 0 ? (
          <p className="text-muted">Belum ada catatan.</p>
        ) : (
          <div className="divide-y divide-border">
            {notes.map((n) => (
              <NoteCard key={n.id} note={n} viewerId={viewer?.id} viewerIsAdmin={viewer?.role === "admin"} />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
