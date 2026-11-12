import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { getDb, schema } from "@/db";
import { requireUser } from "@/lib/auth";
import { isCategory } from "@/lib/categories";
import { getMembership, getPostTags, getPublicationById } from "@/server/queries";
import { PostEditor } from "./editor";

export const metadata: Metadata = { title: "Editor" };
export const dynamic = "force-dynamic";

export default async function EditPostPage({ params }: PageProps<"/dasbor/tulisan/[id]">) {
  const { id } = await params;
  const user = await requireUser(`/dasbor/tulisan/${id}`);

  const post = await getDb().select().from(schema.posts).where(eq(schema.posts.id, id)).get();
  if (!post) notFound();
  const role = await getMembership(post.publicationId, user.id);
  const canEdit = role && (post.authorId === user.id || role === "owner" || role === "editor");
  if (!canEdit) notFound();

  const [pub, tags] = await Promise.all([getPublicationById(post.publicationId), getPostTags(post.id)]);
  if (!pub) notFound();

  return (
    <PostEditor
      post={{
        id: post.id,
        title: post.title,
        subtitle: post.subtitle ?? "",
        coverUrl: post.coverUrl,
        category: isCategory(post.category) ? post.category : null,
        tags: tags.map((t) => t.name),
        contentJson: post.contentJson,
        status: post.status,
        emailed: Boolean(post.emailedAt),
        publicUrl: post.status === "published" ? `/@${pub.slug}/p/${post.slug}` : null,
        publicationName: pub.name,
        publicationId: pub.id,
      }}
    />
  );
}
