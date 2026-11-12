import type { Metadata } from "next";
import { and, desc, eq } from "drizzle-orm";
import { PostCard } from "@/components/post-card";
import { getDb, schema } from "@/db";
import { requireUser } from "@/lib/auth";
import { postCardFields } from "@/server/queries";

export const metadata: Metadata = { title: "Tersimpan" };
export const dynamic = "force-dynamic";

export default async function SavedPage() {
  const user = await requireUser("/tersimpan");
  const { posts, publications, users, bookmarks } = schema;
  const list = await getDb()
    .select(postCardFields)
    .from(bookmarks)
    .innerJoin(posts, eq(posts.id, bookmarks.postId))
    .innerJoin(publications, eq(publications.id, posts.publicationId))
    .innerJoin(users, eq(users.id, posts.authorId))
    .where(and(eq(bookmarks.userId, user.id), eq(posts.status, "published")))
    .orderBy(desc(bookmarks.createdAt))
    .limit(200);

  return (
    <main className="mx-auto w-full max-w-[680px] flex-1 px-4 py-12">
      <h1 className="font-serif text-3xl font-semibold">Tersimpan</h1>
      {list.length === 0 ? (
        <p className="mt-6 text-muted">Belum ada tulisan yang disimpan. Tekan ☆ Simpan di sebuah tulisan.</p>
      ) : (
        <div className="divide-y divide-border">
          {list.map((p) => (
            <PostCard key={p.id} post={p} />
          ))}
        </div>
      )}
    </main>
  );
}
