"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect } from "react";
import { ImageUpload } from "@/components/image-upload";
import { Button, Field, FormMessage, inputClass } from "@/components/ui";
import { authClient } from "@/lib/auth-client";
import { updateProfile, type ProfileState } from "@/server/profile";

export function ProfileForm({
  defaults,
}: {
  defaults: { name: string; username: string; bio: string; email: string; image: string | null };
}) {
  const [state, action, pending] = useActionState<ProfileState, FormData>(updateProfile, {});
  const router = useRouter();

  useEffect(() => {
    if (state.ok) {
      // Perbarui sesi di header (nama/username).
      authClient.$store.notify("$sessionSignal");
      router.refresh();
    }
  }, [state, router]);

  return (
    <form action={action} className="space-y-5">
      <Field label="Foto profil" htmlFor="image" error={state.errors?.image}>
        <ImageUpload name="image" kind="avatar" defaultUrl={defaults.image} label="Ganti foto" shape="circle" />
      </Field>
      <Field label="Email" htmlFor="email" hint="Email belum bisa diubah.">
        <input id="email" value={defaults.email} disabled className={inputClass} readOnly />
      </Field>
      <Field label="Nama" htmlFor="name" error={state.errors?.name}>
        <input id="name" name="name" defaultValue={defaults.name} required maxLength={80} className={inputClass} />
      </Field>
      <Field
        label="Username"
        htmlFor="username"
        error={state.errors?.username}
        hint="Alamat profil Anda: /u/username. Huruf kecil, angka, dan _."
      >
        <div className="flex items-center rounded-md border border-border focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/20">
          <span className="pl-3 text-muted">@</span>
          <input
            id="username"
            name="username"
            defaultValue={defaults.username}
            required
            minLength={3}
            maxLength={30}
            pattern="[a-zA-Z0-9_]+"
            autoCapitalize="none"
            spellCheck={false}
            className="w-full bg-transparent px-1 py-2 text-base outline-none"
          />
        </div>
      </Field>
      <Field label="Bio" htmlFor="bio" error={state.errors?.bio} hint="Maksimal 300 karakter.">
        <textarea
          id="bio"
          name="bio"
          defaultValue={defaults.bio}
          rows={4}
          maxLength={300}
          dir="auto"
          className={inputClass}
        />
      </Field>

      <FormMessage ok={state.ok}>{state.message}</FormMessage>

      <Button type="submit" disabled={pending}>
        {pending ? "Menyimpan…" : "Simpan"}
      </Button>
    </form>
  );
}
