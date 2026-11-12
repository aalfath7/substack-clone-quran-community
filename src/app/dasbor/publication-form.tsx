"use client";

import { useActionState, useState } from "react";
import { ImageUpload } from "@/components/image-upload";
import { Button, Field, FormMessage, inputClass } from "@/components/ui";
import { toSlug } from "@/lib/validation";
import type { PublicationState } from "@/server/publications";

type Values = {
  name: string;
  slug: string;
  tagline: string;
  description: string;
  logoUrl: string;
  supportUrl: string;
  supportText: string;
};

export function PublicationForm({
  action,
  defaults,
  submitLabel,
}: {
  action: (prev: PublicationState, formData: FormData) => Promise<PublicationState>;
  defaults?: Values;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const isNew = !defaults;
  const [name, setName] = useState(defaults?.name ?? "");
  const [slug, setSlug] = useState(defaults?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(!isNew);

  return (
    <form action={formAction} className="space-y-5">
      <Field label="Nama publikasi" htmlFor="name" error={state.errors?.name}>
        <input
          id="name"
          name="name"
          required
          maxLength={80}
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (!slugTouched) setSlug(toSlug(e.target.value));
          }}
          placeholder="mis. Catatan Tadabbur Harian"
          className={inputClass}
        />
      </Field>

      <Field
        label="Alamat"
        htmlFor="slug"
        error={state.errors?.slug}
        hint={!isNew ? "Mengubah alamat membuat tautan lama tidak berlaku." : "Huruf kecil, angka, dan tanda hubung."}
      >
        <div className="flex items-center rounded-md border border-border focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/20">
          <span className="pl-3 text-muted">/@</span>
          <input
            id="slug"
            name="slug"
            required
            minLength={3}
            maxLength={40}
            value={slug}
            onChange={(e) => {
              setSlugTouched(true);
              setSlug(e.target.value.toLowerCase());
            }}
            autoCapitalize="none"
            spellCheck={false}
            className="w-full bg-transparent px-1 py-2 text-base outline-none"
          />
        </div>
      </Field>

      <Field label="Tagline" htmlFor="tagline" error={state.errors?.tagline} hint="Satu kalimat singkat. Opsional.">
        <input
          id="tagline"
          name="tagline"
          maxLength={140}
          defaultValue={defaults?.tagline}
          dir="auto"
          className={inputClass}
        />
      </Field>

      <Field label="Deskripsi" htmlFor="description" error={state.errors?.description} hint="Tentang publikasi ini. Opsional.">
        <textarea
          id="description"
          name="description"
          rows={5}
          maxLength={2000}
          defaultValue={defaults?.description}
          dir="auto"
          className={inputClass}
        />
      </Field>

      {!isNew && (
        <>
          <Field label="Logo" htmlFor="logoUrl" error={state.errors?.logoUrl}>
            <ImageUpload name="logoUrl" kind="logo" defaultUrl={defaults?.logoUrl || null} label="Pilih logo" shape="circle" />
          </Field>

          <fieldset className="space-y-4 rounded-md border border-border p-4">
            <legend className="px-1 text-sm font-medium">Dukungan / infaq</legend>
            <p className="text-sm text-muted">
              Tampilkan tombol &quot;Dukung&quot; yang mengarah ke halaman donasi Anda (mis. Saweria, Trakteer, KitaBisa,
              atau halaman rekening lembaga). Kosongkan untuk menyembunyikan.
            </p>
            <Field label="Tautan dukungan" htmlFor="supportUrl" error={state.errors?.supportUrl}>
              <input
                id="supportUrl"
                name="supportUrl"
                type="url"
                inputMode="url"
                placeholder="https://"
                defaultValue={defaults?.supportUrl}
                className={inputClass}
              />
            </Field>
            <Field label="Ajakan singkat" htmlFor="supportText" error={state.errors?.supportText} hint="Maks 200 karakter.">
              <input
                id="supportText"
                name="supportText"
                maxLength={200}
                placeholder="mis. Bantu kami terus menulis kajian setiap pekan."
                defaultValue={defaults?.supportText}
                className={inputClass}
              />
            </Field>
          </fieldset>
        </>
      )}

      <FormMessage ok={state.ok}>{state.message}</FormMessage>

      <Button type="submit" disabled={pending}>
        {pending ? "Menyimpan…" : submitLabel}
      </Button>
    </form>
  );
}
