"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { LikeButton, ReportButton } from "@/components/actions";
import { Avatar, Button, inputClass } from "@/components/ui";
import { timeAgo } from "@/lib/format";
import { addComment, deleteComment, type ActionState } from "@/server/community";

type CommentItem = {
  id: string;
  parentId: string | null;
  body: string;
  createdAt: Date;
  deletedAt: Date | null;
  userId: string;
  userName: string;
  username: string | null;
  userImage: string | null;
  liked: boolean;
  likes: number;
};

export function Comments({
  postId,
  comments,
  viewer,
  canModerate,
}: {
  postId: string;
  comments: CommentItem[];
  viewer: { id: string; role: string } | null;
  canModerate: boolean;
}) {
  const roots = comments.filter((c) => !c.parentId);
  const replies = new Map<string, CommentItem[]>();
  for (const c of comments) {
    if (c.parentId) replies.set(c.parentId, [...(replies.get(c.parentId) ?? []), c]);
  }
  const visibleCount = comments.filter((c) => !c.deletedAt).length;
  const router = useRouter();

  return (
    <section id="komentar" className="mt-14">
      <h2 className="mb-6 text-lg font-semibold">Komentar ({visibleCount})</h2>
      {viewer ? (
        <CommentForm postId={postId} parentId={null} />
      ) : (
        <p className="rounded-md bg-foreground/5 p-4 text-sm">
          <button
            type="button"
            className="font-medium text-accent hover:underline"
            onClick={() => router.push(`/masuk?next=${encodeURIComponent(location.pathname + "#komentar")}`)}
          >
            Masuk
          </button>{" "}
          untuk ikut berdiskusi.
        </p>
      )}

      <ul className="mt-8 space-y-8">
        {roots.map((c) => {
          const kids = replies.get(c.id) ?? [];
          // Sembunyikan komentar terhapus yang tidak punya balasan.
          if (c.deletedAt && kids.every((k) => k.deletedAt)) return null;
          return (
            <li key={c.id}>
              <Comment c={c} postId={postId} viewer={viewer} canModerate={canModerate} canReply={Boolean(viewer)} />
              {kids.length > 0 && (
                <ul className="mt-4 ml-5 space-y-5 border-l border-border pl-5">
                  {kids
                    .filter((k) => !k.deletedAt)
                    .map((k) => (
                      <li key={k.id}>
                        <Comment c={k} postId={postId} viewer={viewer} canModerate={canModerate} canReply={Boolean(viewer)} />
                      </li>
                    ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function Comment({
  c,
  postId,
  viewer,
  canModerate,
  canReply,
}: {
  c: CommentItem;
  postId: string;
  viewer: { id: string; role: string } | null;
  canModerate: boolean;
  canReply: boolean;
}) {
  const [replying, setReplying] = useState(false);
  const [pending, start] = useTransition();

  if (c.deletedAt) return <p className="text-sm text-muted italic">Komentar dihapus.</p>;

  const canDelete = viewer && (viewer.id === c.userId || viewer.role === "admin" || canModerate);

  return (
    <div>
      <div className="flex items-center gap-2 text-sm">
        <Avatar name={c.userName} image={c.userImage} size={24} />
        {c.username ? (
          <Link href={`/u/${c.username}`} className="font-medium hover:underline">
            {c.userName}
          </Link>
        ) : (
          <span className="font-medium">{c.userName}</span>
        )}
        <span className="text-muted">· {timeAgo(new Date(c.createdAt))}</span>
      </div>
      <p dir="auto" className="mt-2 whitespace-pre-line">
        {c.body}
      </p>
      <div className="mt-2 flex items-center gap-3">
        <LikeButton targetType="comment" targetId={c.id} liked={c.liked} count={c.likes} size="sm" />
        {canReply && (
          <button type="button" className="text-xs text-muted hover:underline" onClick={() => setReplying((v) => !v)}>
            Balas
          </button>
        )}
        {canDelete && (
          <button
            type="button"
            disabled={pending}
            className="text-xs text-muted hover:underline"
            onClick={() => {
              if (confirm("Hapus komentar ini?")) start(() => deleteComment(c.id));
            }}
          >
            Hapus
          </button>
        )}
        {viewer && viewer.id !== c.userId && <ReportButton targetType="comment" targetId={c.id} />}
      </div>
      {replying && (
        <div className="mt-3">
          <CommentForm postId={postId} parentId={c.parentId ?? c.id} onDone={() => setReplying(false)} autoFocus />
        </div>
      )}
    </div>
  );
}

function CommentForm({
  postId,
  parentId,
  onDone,
  autoFocus,
}: {
  postId: string;
  parentId: string | null;
  onDone?: () => void;
  autoFocus?: boolean;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(addComment.bind(null, postId, parentId), {});
  const form = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) {
      form.current?.reset();
      onDone?.();
    }
  }, [state, onDone]);

  return (
    <form ref={form} action={action} className="space-y-2">
      <textarea
        name="body"
        required
        maxLength={3000}
        rows={parentId ? 2 : 3}
        dir="auto"
        autoFocus={autoFocus}
        placeholder={parentId ? "Tulis balasan…" : "Tulis komentar dengan adab yang baik…"}
        aria-label={parentId ? "Balasan" : "Komentar"}
        className={inputClass}
      />
      {(state.errors?.body || state.message) && (
        <p className="text-sm text-red-600 dark:text-red-400">{state.errors?.body ?? state.message}</p>
      )}
      <Button type="submit" disabled={pending} className="text-sm">
        {pending ? "Mengirim…" : parentId ? "Balas" : "Kirim komentar"}
      </Button>
    </form>
  );
}
