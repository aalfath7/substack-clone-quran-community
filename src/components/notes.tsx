"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useTransition } from "react";
import { createNote, deleteNote, type ActionState } from "@/server/community";
import { timeAgo } from "@/lib/format";
import { LikeButton, ReportButton } from "./actions";
import { Avatar, Button, inputClass } from "./ui";

export type NoteView = {
  id: string;
  body: string;
  createdAt: Date;
  authorId: string;
  authorName: string;
  authorUsername: string | null;
  authorImage: string | null;
  liked: boolean;
  likes: number;
};

export function NoteComposer() {
  const [state, action, pending] = useActionState<ActionState, FormData>(createNote, {});
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok) form.current?.reset();
  }, [state]);

  return (
    <form ref={form} action={action} className="space-y-2 rounded-lg border border-border p-4">
      <label htmlFor="note-body" className="sr-only">
        Catatan
      </label>
      <textarea
        id="note-body"
        name="body"
        rows={3}
        maxLength={1000}
        required
        dir="auto"
        placeholder="Bagikan renungan singkat, ayat yang menyentuh, atau progres hafalan hari ini…"
        className={inputClass}
      />
      {state.errors?.body && <p className="text-sm text-red-600 dark:text-red-400">{state.errors.body}</p>}
      <div className="text-right">
        <Button type="submit" disabled={pending}>
          {pending ? "Mengirim…" : "Kirim catatan"}
        </Button>
      </div>
    </form>
  );
}

export function NoteCard({ note, viewerId, viewerIsAdmin }: { note: NoteView; viewerId?: string; viewerIsAdmin?: boolean }) {
  const [pending, start] = useTransition();
  const mine = viewerId === note.authorId;
  return (
    <article className="py-5">
      <div className="flex items-center gap-2 text-sm">
        <Avatar name={note.authorName} image={note.authorImage} size={28} />
        {note.authorUsername ? (
          <Link href={`/u/${note.authorUsername}`} className="font-medium hover:underline">
            {note.authorName}
          </Link>
        ) : (
          <span className="font-medium">{note.authorName}</span>
        )}
        <span className="text-muted">· {timeAgo(new Date(note.createdAt))}</span>
      </div>
      <p dir="auto" className="mt-2 font-serif text-lg leading-8 whitespace-pre-line">
        {note.body}
      </p>
      <div className="mt-2 flex items-center gap-3">
        <LikeButton targetType="note" targetId={note.id} liked={note.liked} count={note.likes} size="sm" />
        {(mine || viewerIsAdmin) && (
          <button
            type="button"
            disabled={pending}
            className="text-xs text-muted hover:underline"
            onClick={() => {
              if (confirm("Hapus catatan ini?")) start(() => deleteNote(note.id));
            }}
          >
            Hapus
          </button>
        )}
        {viewerId && !mine && <ReportButton targetType="note" targetId={note.id} />}
      </div>
    </article>
  );
}
