import Link from "next/link";
import { CATEGORY_LABEL, isCategory } from "@/lib/categories";
import { formatDate } from "@/lib/format";
import type { PostCard as PostCardData } from "@/server/queries";

export function PostCard({
  post,
  counts,
  showPublication = true,
}: {
  post: PostCardData;
  counts?: { likes: number; comments: number };
  showPublication?: boolean;
}) {
  const href = `/@${post.pubSlug}/p/${post.slug}`;
  return (
    <article className="flex gap-4 py-6">
      <div className="min-w-0 flex-1">
        <p className="mb-1 text-xs text-muted">
          {showPublication && (
            <>
              <Link href={`/@${post.pubSlug}`} className="font-medium text-foreground hover:underline">
                {post.pubName}
              </Link>
              {" · "}
            </>
          )}
          {post.authorName}
          {isCategory(post.category) && (
            <>
              {" · "}
              <Link href={`/jelajah?kategori=${post.category}`} className="hover:underline">
                {CATEGORY_LABEL[post.category]}
              </Link>
            </>
          )}
        </p>
        <Link href={href} className="group block">
          <h3 dir="auto" className="font-serif text-xl leading-snug font-semibold group-hover:underline">
            {post.title}
          </h3>
          {(post.subtitle || post.excerpt) && (
            <p dir="auto" className="mt-1 line-clamp-2 text-muted">
              {post.subtitle || post.excerpt}
            </p>
          )}
        </Link>
        <p className="mt-2 text-xs text-muted">
          {formatDate(post.publishedAt)}
          {counts && (
            <>
              {" · "}♥ {counts.likes} · 💬 {counts.comments}
            </>
          )}
        </p>
      </div>
      {post.coverUrl && (
        <Link href={href} className="shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element -- gambar R2 via /media */}
          <img src={post.coverUrl} alt="" loading="lazy" className="h-20 w-28 rounded-md object-cover sm:h-24 sm:w-36" />
        </Link>
      )}
    </article>
  );
}
