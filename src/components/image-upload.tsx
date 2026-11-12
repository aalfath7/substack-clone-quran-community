"use client";

import { useRef, useState } from "react";
import { Button } from "./ui";

export async function uploadImage(file: File, kind: "avatar" | "cover" | "logo" | "image") {
  const form = new FormData();
  form.append("file", file);
  form.append("kind", kind);
  const res = await fetch("/api/upload", { method: "POST", body: form });
  const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
  if (!res.ok || !data.url) throw new Error(data.error ?? "Upload gagal.");
  return data.url;
}

/** Tombol pilih gambar + pratinjau. Nilai URL dikirim lewat input hidden `name`. */
export function ImageUpload({
  name,
  kind,
  defaultUrl,
  label = "Pilih gambar",
  shape = "rect",
  onChange,
}: {
  name?: string;
  kind: "avatar" | "cover" | "logo";
  defaultUrl?: string | null;
  label?: string;
  shape?: "rect" | "circle";
  onChange?: (url: string | null) => void;
}) {
  const [url, setUrl] = useState<string | null>(defaultUrl ?? null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  function set(next: string | null) {
    setUrl(next);
    onChange?.(next);
  }

  return (
    <div className="flex flex-wrap items-center gap-4">
      {name && <input type="hidden" name={name} value={url ?? ""} />}
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element -- gambar dari R2 via /media
        <img
          src={url}
          alt=""
          className={
            shape === "circle" ? "h-20 w-20 rounded-full object-cover" : "h-24 w-40 rounded-md border border-border object-cover"
          }
        />
      ) : (
        <div
          className={`flex items-center justify-center bg-foreground/5 text-xs text-muted ${
            shape === "circle" ? "h-20 w-20 rounded-full" : "h-24 w-40 rounded-md"
          }`}
        >
          Belum ada
        </div>
      )}
      <div className="flex flex-col gap-2">
        <div className="flex gap-2">
          <Button type="button" variant="secondary" disabled={busy} onClick={() => input.current?.click()}>
            {busy ? "Mengunggah…" : label}
          </Button>
          {url && (
            <Button type="button" variant="ghost" disabled={busy} onClick={() => set(null)}>
              Hapus
            </Button>
          )}
        </div>
        <p className="text-xs text-muted">JPG, PNG, atau WebP. Maks 5 MB.</p>
        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      </div>
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file) return;
          setError(null);
          setBusy(true);
          try {
            set(await uploadImage(file, kind));
          } catch (err) {
            setError(err instanceof Error ? err.message : "Upload gagal.");
          } finally {
            setBusy(false);
          }
        }}
      />
    </div>
  );
}
