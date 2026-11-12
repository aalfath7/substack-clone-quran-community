import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { ProfileForm } from "./profile-form";

export const metadata: Metadata = { title: "Pengaturan" };
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await requireUser("/pengaturan");

  return (
    <main className="mx-auto w-full max-w-xl flex-1 px-4 py-12">
      <h1 className="mb-1 font-serif text-3xl font-semibold">Pengaturan profil</h1>
      <p className="mb-8 text-muted">Informasi ini tampil di profil publik Anda.</p>
      <ProfileForm
        defaults={{
          name: user.name,
          username: user.username ?? "",
          bio: user.bio ?? "",
          email: user.email,
          image: user.image ?? null,
        }}
      />
    </main>
  );
}
