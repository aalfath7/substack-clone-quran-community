"use client";

import Image from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import { EditorContent, useEditor, useEditorState, type Editor as TiptapEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { ImageUpload, uploadImage } from "@/components/image-upload";
import { Button, buttonClass, inputClass } from "@/components/ui";
import { CATEGORY_LABEL, POST_CATEGORIES } from "@/lib/categories";
import { deletePost, publishPost, savePost, unpublishPost, type SaveInput } from "@/server/posts";

export type EditorPost = {
  id: string;
  title: string;
  subtitle: string;
  coverUrl: string | null;
  category: (typeof POST_CATEGORIES)[number] | null;
  tags: string[];
  contentJson: unknown;
  status: "draft" | "published" | "archived";
  emailed: boolean;
  publicUrl: string | null;
  publicationName: string;
  publicationId: string;
};

export function PostEditor({ post }: { post: EditorPost }) {
  const router = useRouter();
  const [title, setTitle] = useState(post.title);
  const [subtitle, setSubtitle] = useState(post.subtitle);
  const [coverUrl, setCoverUrl] = useState(post.coverUrl);
  const [category, setCategory] = useState(post.category);
  const [tagText, setTagText] = useState(post.tags.join(", "));
  const [dirty, setDirty] = useState(false);
  const [status, setStatus] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [publishOpen, setPublishOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const saving = useRef(false);

  const editor = useEditor({
    immediatelyRender: false,
    // dir="auto" per paragraf: teks Arab otomatis rata kanan, Latin rata kiri.
    textDirection: "auto",
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        link: { openOnClick: false, autolink: true, protocols: ["http", "https", "mailto"] },
      }),
      Image.configure({ inline: false }),
      Placeholder.configure({ placeholder: "Mulai menulis… (teks Arab akan otomatis rata kanan)" }),
    ],
    content: (post.contentJson as object) ?? undefined,
    editorProps: { attributes: { class: "prose-content tiptap min-h-[50vh]" } },
    onUpdate: () => setDirty(true),
  });

  const collect = useCallback((): SaveInput | null => {
    if (!editor) return null;
    return {
      title,
      subtitle,
      coverUrl,
      category,
      tags: tagText.split(",").map((t) => t.trim()).filter(Boolean),
      contentJson: editor.getJSON() as SaveInput["contentJson"],
    };
  }, [editor, title, subtitle, coverUrl, category, tagText]);

  const save = useCallback(async () => {
    const data = collect();
    if (!data || saving.current) return false;
    saving.current = true;
    setStatus("Menyimpan…");
    setError(null);
    try {
      const res = await savePost(post.id, data);
      if (res.ok) {
        setDirty(false);
        setStatus(`Tersimpan ${new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}`);
        return true;
      }
      setError(res.message ?? "Gagal menyimpan.");
      setStatus("");
      return false;
    } catch {
      setError("Gagal menyimpan. Periksa koneksi.");
      setStatus("");
      return false;
    } finally {
      saving.current = false;
    }
  }, [collect, post.id]);

  // Simpan otomatis 15 detik setelah perubahan terakhir.
  useEffect(() => {
    if (!dirty) return;
    const t = setTimeout(save, 15_000);
    return () => clearTimeout(t);
  }, [dirty, save, title, subtitle, coverUrl, category, tagText]);

  // Ctrl/Cmd+S dan peringatan saat meninggalkan halaman dengan perubahan belum tersimpan.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        save();
      }
    };
    const onLeave = (e: BeforeUnloadEvent) => {
      if (dirty) e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("beforeunload", onLeave);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("beforeunload", onLeave);
    };
  }, [dirty, save]);

  const touch = <T,>(setter: (v: T) => void) => (v: T) => {
    setter(v);
    setDirty(true);
  };

  const isPublished = post.status === "published";

  return (
    <div className="pb-24">
      <div className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-2 px-4 py-2">
          <div className="flex min-w-0 items-center gap-3 text-sm">
            <Link href={`/dasbor/publikasi/${post.publicationId}`} className="truncate text-muted hover:underline">
              ← {post.publicationName}
            </Link>
            <span className="rounded-full bg-foreground/5 px-2 py-0.5 text-xs">
              {isPublished ? "Terbit" : "Draf"}
            </span>
            <span className="text-xs text-muted" aria-live="polite">
              {dirty && !status ? "Belum tersimpan" : status}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {isPublished && post.publicUrl && (
              <a href={post.publicUrl} target="_blank" className={buttonClass("ghost")}>
                Lihat
              </a>
            )}
            <Button variant="secondary" onClick={save} disabled={pending}>
              Simpan
            </Button>
            <Button onClick={() => setPublishOpen(true)} disabled={pending}>
              {isPublished ? "Perbarui" : "Terbitkan"}
            </Button>
          </div>
        </div>
      </div>

      {error && (
        <div className="mx-auto mt-4 max-w-3xl px-4">
          <p role="alert" className="rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-400">
            {error}
          </p>
        </div>
      )}

      <div className="mx-auto max-w-[720px] px-4 pt-8">
        <details className="mb-6 rounded-md border border-border p-4" open={!post.title}>
          <summary className="cursor-pointer text-sm font-medium">Cover, kategori & tag</summary>
          <div className="mt-4 space-y-4">
            <ImageUpload kind="cover" defaultUrl={coverUrl} label="Pilih cover" onChange={touch(setCoverUrl)} />
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-1.5 text-sm">
                <span className="font-medium">Kategori</span>
                <select
                  value={category ?? ""}
                  onChange={(e) => touch(setCategory)((e.target.value || null) as EditorPost["category"])}
                  className={inputClass}
                >
                  <option value="">Tanpa kategori</option>
                  {POST_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {CATEGORY_LABEL[c]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1.5 text-sm">
                <span className="font-medium">Tag (pisahkan dengan koma, maks 5)</span>
                <input
                  value={tagText}
                  onChange={(e) => touch(setTagText)(e.target.value)}
                  placeholder="mis. al-baqarah, sabar"
                  className={inputClass}
                />
              </label>
            </div>
          </div>
        </details>

        <textarea
          value={title}
          onChange={(e) => touch(setTitle)(e.target.value)}
          placeholder="Judul"
          rows={1}
          maxLength={200}
          dir="auto"
          className="w-full resize-none bg-transparent font-serif text-4xl leading-tight font-semibold outline-none [field-sizing:content] placeholder:text-muted/60"
        />
        <textarea
          value={subtitle}
          onChange={(e) => touch(setSubtitle)(e.target.value)}
          placeholder="Subjudul (opsional)"
          rows={1}
          maxLength={300}
          dir="auto"
          className="mt-2 w-full resize-none bg-transparent font-serif text-xl text-muted outline-none [field-sizing:content] placeholder:text-muted/50"
        />

        {editor && <Toolbar editor={editor} onError={setError} />}
        <div className="mt-4">
          <EditorContent editor={editor} />
        </div>

        <div className="mt-16 flex flex-wrap gap-2 border-t border-border pt-6">
          {isPublished && (
            <Button
              variant="secondary"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const res = await unpublishPost(post.id);
                  if (!res.ok) setError(res.message ?? "Gagal.");
                  router.refresh();
                })
              }
            >
              Tarik ke draf
            </Button>
          )}
          <Button
            variant="ghost"
            className="text-red-600 dark:text-red-400"
            disabled={pending}
            onClick={() => {
              if (!confirm("Hapus tulisan ini secara permanen?")) return;
              setDirty(false);
              startTransition(async () => {
                const res = await deletePost(post.id);
                if (res?.message) setError(res.message);
              });
            }}
          >
            Hapus tulisan
          </Button>
        </div>
      </div>

      {publishOpen && (
        <PublishDialog
          isPublished={isPublished}
          emailed={post.emailed}
          onClose={() => setPublishOpen(false)}
          onConfirm={(sendEmail) =>
            startTransition(async () => {
              if (!(await save())) {
                setPublishOpen(false);
                return;
              }
              const res = await publishPost(post.id, { sendEmail });
              setPublishOpen(false);
              if (!res.ok) {
                setError(res.message ?? "Gagal menerbitkan.");
                return;
              }
              setStatus(res.message ?? "Terbit");
              router.refresh();
              if (res.url && !isPublished) router.push(res.url);
            })
          }
          pending={pending}
        />
      )}
    </div>
  );
}

function PublishDialog({
  isPublished,
  emailed,
  onClose,
  onConfirm,
  pending,
}: {
  isPublished: boolean;
  emailed: boolean;
  onClose: () => void;
  onConfirm: (sendEmail: boolean) => void;
  pending: boolean;
}) {
  const [sendEmail, setSendEmail] = useState(!emailed);
  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-30 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-lg border border-border bg-background p-6 shadow-xl">
        <h2 className="font-serif text-2xl font-semibold">{isPublished ? "Perbarui tulisan?" : "Terbitkan tulisan?"}</h2>
        <p className="mt-2 text-muted">
          {isPublished
            ? "Perubahan akan langsung tampil di halaman publik."
            : "Tulisan akan tampil di halaman publikasi Anda."}
        </p>
        {!emailed ? (
          <label className="mt-4 flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              checked={sendEmail}
              onChange={(e) => setSendEmail(e.target.checked)}
              className="mt-1"
            />
            Kirim juga lewat email ke semua pelanggan
          </label>
        ) : (
          <p className="mt-4 text-sm text-muted">Email untuk tulisan ini sudah pernah dikirim.</p>
        )}
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            Batal
          </Button>
          <Button onClick={() => onConfirm(sendEmail && !emailed)} disabled={pending}>
            {pending ? "Memproses…" : isPublished ? "Perbarui" : "Terbitkan"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function Toolbar({ editor, onError }: { editor: TiptapEditor; onError: (msg: string | null) => void }) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const s = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive("bold"),
      italic: e.isActive("italic"),
      underline: e.isActive("underline"),
      strike: e.isActive("strike"),
      h2: e.isActive("heading", { level: 2 }),
      h3: e.isActive("heading", { level: 3 }),
      bullet: e.isActive("bulletList"),
      ordered: e.isActive("orderedList"),
      quote: e.isActive("blockquote"),
      link: e.isActive("link"),
    }),
  });

  const btn = (active: boolean) =>
    `min-w-8 rounded px-2 py-1 text-sm ${active ? "bg-foreground/10 font-semibold" : "hover:bg-foreground/5"}`;
  const chain = () => editor.chain().focus();

  return (
    <div className="sticky top-[49px] z-[5] mt-6 flex flex-wrap gap-1 border-y border-border bg-background/95 py-1 backdrop-blur" role="toolbar" aria-label="Format teks">
      <button type="button" className={btn(s.bold)} onClick={() => chain().toggleBold().run()} aria-label="Tebal"><b>B</b></button>
      <button type="button" className={btn(s.italic)} onClick={() => chain().toggleItalic().run()} aria-label="Miring"><i>I</i></button>
      <button type="button" className={btn(s.underline)} onClick={() => chain().toggleUnderline().run()} aria-label="Garis bawah"><u>U</u></button>
      <button type="button" className={btn(s.strike)} onClick={() => chain().toggleStrike().run()} aria-label="Coret"><s>S</s></button>
      <span className="mx-1 w-px bg-border" />
      <button type="button" className={btn(s.h2)} onClick={() => chain().toggleHeading({ level: 2 }).run()}>H2</button>
      <button type="button" className={btn(s.h3)} onClick={() => chain().toggleHeading({ level: 3 }).run()}>H3</button>
      <button type="button" className={btn(s.bullet)} onClick={() => chain().toggleBulletList().run()} aria-label="Daftar poin">• Daftar</button>
      <button type="button" className={btn(s.ordered)} onClick={() => chain().toggleOrderedList().run()} aria-label="Daftar nomor">1. Daftar</button>
      <button type="button" className={btn(s.quote)} onClick={() => chain().toggleBlockquote().run()} aria-label="Kutipan">❝ Kutipan</button>
      <button type="button" className={btn(false)} onClick={() => chain().setHorizontalRule().run()} aria-label="Garis pemisah">—</button>
      <span className="mx-1 w-px bg-border" />
      <button
        type="button"
        className={btn(s.link)}
        onClick={() => {
          if (s.link) return chain().unsetLink().run();
          const url = prompt("Alamat tautan (https://…)");
          if (url) chain().extendMarkRange("link").setLink({ href: url }).run();
        }}
      >
        {s.link ? "Hapus tautan" : "Tautan"}
      </button>
      <button type="button" className={btn(false)} disabled={uploading} onClick={() => fileInput.current?.click()}>
        {uploading ? "Mengunggah…" : "Gambar"}
      </button>
      <input
        ref={fileInput}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file) return;
          setUploading(true);
          onError(null);
          try {
            const url = await uploadImage(file, "image");
            chain().setImage({ src: url, alt: "" }).run();
          } catch (err) {
            onError(err instanceof Error ? err.message : "Upload gagal.");
          } finally {
            setUploading(false);
          }
        }}
      />
      <span className="mx-1 w-px bg-border" />
      <button type="button" className={btn(false)} onClick={() => chain().undo().run()} aria-label="Urungkan">↶</button>
      <button type="button" className={btn(false)} onClick={() => chain().redo().run()} aria-label="Ulangi">↷</button>
    </div>
  );
}
