import { getCloudflareContext } from "@opennextjs/cloudflare";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { safeNext } from "@/lib/safe-next";
import { AuthForm } from "./auth-form";

export async function AuthPage({
  mode,
  searchParams,
}: {
  mode: "masuk" | "daftar";
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const next = safeNext((await searchParams).next);
  if (await getSession()) redirect(next);

  const { env } = getCloudflareContext();
  const googleEnabled = Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);

  return (
    <main className="mx-auto w-full max-w-sm flex-1 px-4 py-16">
      <h1 className="mb-2 font-serif text-3xl font-semibold">
        {mode === "masuk" ? "Masuk" : "Buat akun"}
      </h1>
      <p className="mb-8 text-muted">
        {mode === "masuk"
          ? "Selamat datang kembali."
          : "Mulai menulis dan berlangganan publikasi."}
      </p>
      <AuthForm mode={mode} next={next} googleEnabled={googleEnabled} />
    </main>
  );
}
