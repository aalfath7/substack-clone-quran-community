"use client";

import { useRouter } from "next/navigation";
import { useActionState, useState, useTransition } from "react";
import {
  reportContent,
  subscribe,
  toggleBookmark,
  toggleFollow,
  toggleLike,
  unsubscribeSelf,
  type ActionState,
} from "@/server/community";
import { Button, FormMessage, inputClass } from "./ui";

function useLoginRedirect() {
  const router = useRouter();
  return () => router.push(`/masuk?next=${encodeURIComponent(location.pathname)}`);
}

export function LikeButton({
  targetType,
  targetId,
  liked: initialLiked,
  count: initialCount,
  size = "md",
}: {
  targetType: "post" | "note" | "comment";
  targetId: string;
  liked: boolean;
  count: number;
  size?: "sm" | "md";
}) {
  const [liked, setLiked] = useState(initialLiked);
  const [count, setCount] = useState(initialCount);
  const [pending, start] = useTransition();
  const toLogin = useLoginRedirect();

  return (
    <button
      type="button"
      aria-pressed={liked}
      aria-label={liked ? "Batal suka" : "Suka"}
      disabled={pending}
      onClick={() =>
        start(async () => {
          // Optimistis, lalu sesuaikan dengan jawaban server.
          setLiked(!liked);
          setCount((c) => c + (liked ? -1 : 1));
          const res = await toggleLike(targetType, targetId);
          if ("needLogin" in res) return toLogin();
          if ("liked" in res) {
            setLiked(res.liked);
            setCount(res.count);
          }
        })
      }
      className={`inline-flex items-center gap-1.5 rounded-full border border-border ${
        size === "sm" ? "px-2 py-0.5 text-xs" : "px-3 py-1.5 text-sm"
      } ${liked ? "border-accent/40 bg-accent/10 text-accent" : "hover:bg-foreground/5"}`}
    >
      <span aria-hidden>{liked ? "♥" : "♡"}</span>
      {count}
    </button>
  );
}

export function BookmarkButton({ postId, saved: initial }: { postId: string; saved: boolean }) {
  const [saved, setSaved] = useState(initial);
  const [pending, start] = useTransition();
  const toLogin = useLoginRedirect();
  return (
    <button
      type="button"
      aria-pressed={saved}
      disabled={pending}
      onClick={() =>
        start(async () => {
          setSaved(!saved);
          const res = await toggleBookmark(postId);
          if ("needLogin" in res) return toLogin();
          setSaved(res.saved);
        })
      }
      className={`inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-sm ${
        saved ? "border-accent/40 bg-accent/10 text-accent" : "hover:bg-foreground/5"
      }`}
    >
      <span aria-hidden>{saved ? "★" : "☆"}</span>
      {saved ? "Tersimpan" : "Simpan"}
    </button>
  );
}

export function ShareButton({ title }: { title: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        const url = location.href;
        if (navigator.share) {
          try {
            await navigator.share({ title, url });
            return;
          } catch {}
        }
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-sm hover:bg-foreground/5"
    >
      {copied ? "Tautan disalin" : "Bagikan"}
    </button>
  );
}

export function FollowButton({
  userId,
  following: initial,
  followers: initialFollowers,
}: {
  userId: string;
  following: boolean;
  followers: number;
}) {
  const [following, setFollowing] = useState(initial);
  const [followers, setFollowers] = useState(initialFollowers);
  const [pending, start] = useTransition();
  const toLogin = useLoginRedirect();
  return (
    <div className="flex items-center gap-3">
      <Button
        variant={following ? "secondary" : "primary"}
        disabled={pending}
        onClick={() =>
          start(async () => {
            const res = await toggleFollow(userId);
            if ("needLogin" in res) return toLogin();
            if ("following" in res) {
              setFollowing(res.following);
              setFollowers(res.followers);
            }
          })
        }
      >
        {following ? "Mengikuti" : "Ikuti"}
      </Button>
      <span className="text-sm text-muted">{followers} pengikut</span>
    </div>
  );
}

export function SubscribeForm({
  publicationId,
  pubName,
  loggedIn,
  subscribed,
  compact = false,
}: {
  publicationId: string;
  pubName: string;
  loggedIn: boolean;
  subscribed: boolean;
  compact?: boolean;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(subscribe.bind(null, publicationId), {});
  const [unsubPending, startUnsub] = useTransition();
  const router = useRouter();

  if (subscribed && !state.ok) {
    return (
      <div className="flex flex-wrap items-center justify-center gap-3">
        <span className="text-sm text-muted">Anda berlangganan {pubName}.</span>
        <Button
          variant="ghost"
          disabled={unsubPending}
          onClick={() =>
            startUnsub(async () => {
              if (!confirm(`Berhenti berlangganan ${pubName}?`)) return;
              await unsubscribeSelf(publicationId);
              router.refresh();
            })
          }
        >
          Berhenti
        </Button>
      </div>
    );
  }

  if (state.ok) return <FormMessage ok>{state.message}</FormMessage>;

  return (
    <form action={action} className={`mx-auto w-full ${compact ? "" : "max-w-md"} space-y-2`}>
      <div className="flex gap-2">
        {!loggedIn && (
          <input
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="Email Anda"
            aria-label="Email"
            className={inputClass}
          />
        )}
        <Button type="submit" disabled={pending} className={loggedIn ? "w-full" : "shrink-0"}>
          {pending ? "…" : "Berlangganan"}
        </Button>
      </div>
      {state.errors?.email && <p className="text-sm text-red-600 dark:text-red-400">{state.errors.email}</p>}
      <FormMessage>{state.message}</FormMessage>
    </form>
  );
}

export function ReportButton({ targetType, targetId }: { targetType: "post" | "note" | "comment"; targetId: string }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<ActionState, FormData>(reportContent, {});
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="text-xs text-muted hover:underline">
        Laporkan
      </button>
      {open && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-30 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-lg border border-border bg-background p-6 shadow-xl">
            <h2 className="font-serif text-xl font-semibold">Laporkan konten</h2>
            {state.ok ? (
              <>
                <FormMessage ok>{state.message}</FormMessage>
                <div className="mt-4 text-right">
                  <Button variant="secondary" onClick={() => setOpen(false)}>
                    Tutup
                  </Button>
                </div>
              </>
            ) : (
              <form action={action} className="mt-4 space-y-3">
                <input type="hidden" name="targetType" value={targetType} />
                <input type="hidden" name="targetId" value={targetId} />
                <label htmlFor={`reason-${targetId}`} className="block text-sm">
                  Apa masalahnya? (mis. isi menyimpang, ujaran kebencian, spam)
                </label>
                <textarea id={`reason-${targetId}`} name="reason" rows={4} required maxLength={500} className={inputClass} />
                {state.errors?.reason && <p className="text-sm text-red-600 dark:text-red-400">{state.errors.reason}</p>}
                <FormMessage>{state.message}</FormMessage>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                    Batal
                  </Button>
                  <Button type="submit" disabled={pending}>
                    Kirim laporan
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
