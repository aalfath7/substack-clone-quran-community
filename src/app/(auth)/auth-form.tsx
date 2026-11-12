"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, Field, FormMessage, inputClass } from "@/components/ui";
import { signIn, signUp } from "@/lib/auth-client";

// Terjemahan kode error Better Auth yang umum.
const ERRORS: Record<string, string> = {
  INVALID_EMAIL_OR_PASSWORD: "Email atau password salah.",
  USER_ALREADY_EXISTS: "Email ini sudah terdaftar. Silakan masuk.",
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: "Email ini sudah terdaftar. Silakan masuk.",
  PASSWORD_TOO_SHORT: "Password minimal 8 karakter.",
  PASSWORD_TOO_LONG: "Password terlalu panjang.",
  INVALID_EMAIL: "Format email tidak valid.",
};

function errorText(err: { code?: string; message?: string } | null) {
  if (!err) return "Terjadi kesalahan. Coba lagi.";
  if (err.code && ERRORS[err.code]) return ERRORS[err.code];
  if (err.code === "TOO_MANY_REQUESTS" || err.message?.includes("Too many")) {
    return "Terlalu banyak percobaan. Tunggu sebentar.";
  }
  return err.message || "Terjadi kesalahan. Coba lagi.";
}

export function AuthForm({
  mode,
  next,
  googleEnabled,
}: {
  mode: "masuk" | "daftar";
  next: string;
  googleEnabled: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const isSignUp = mode === "daftar";

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const form = new FormData(e.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");

    const { error } = isSignUp
      ? await signUp.email({ name: String(form.get("name") ?? "").trim(), email, password })
      : await signIn.email({ email, password });

    if (error) {
      setError(errorText(error));
      setPending(false);
      return;
    }
    router.push(next);
    router.refresh();
  }

  async function onGoogle() {
    setError(null);
    setPending(true);
    const { error } = await signIn.social({ provider: "google", callbackURL: next });
    if (error) {
      setError(errorText(error));
      setPending(false);
    }
  }

  const otherHref = `/${isSignUp ? "masuk" : "daftar"}${next !== "/dasbor" ? `?next=${encodeURIComponent(next)}` : ""}`;

  return (
    <div className="space-y-6">
      {googleEnabled && (
        <>
          <Button type="button" variant="secondary" className="w-full" onClick={onGoogle} disabled={pending}>
            Lanjut dengan Google
          </Button>
          <div className="flex items-center gap-3 text-xs text-muted">
            <span className="h-px flex-1 bg-border" />
            atau dengan email
            <span className="h-px flex-1 bg-border" />
          </div>
        </>
      )}

      <form onSubmit={onSubmit} className="space-y-4">
        {isSignUp && (
          <Field label="Nama" htmlFor="name">
            <input id="name" name="name" required maxLength={80} autoComplete="name" className={inputClass} />
          </Field>
        )}
        <Field label="Email" htmlFor="email">
          <input id="email" name="email" type="email" required autoComplete="email" className={inputClass} />
        </Field>
        <Field label="Password" htmlFor="password" hint={isSignUp ? "Minimal 8 karakter." : undefined}>
          <input
            id="password"
            name="password"
            type="password"
            required
            minLength={8}
            maxLength={128}
            autoComplete={isSignUp ? "new-password" : "current-password"}
            className={inputClass}
          />
        </Field>

        <FormMessage>{error}</FormMessage>

        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? "Memproses…" : isSignUp ? "Buat akun" : "Masuk"}
        </Button>
      </form>

      <p className="text-center text-sm text-muted">
        {isSignUp ? "Sudah punya akun? " : "Belum punya akun? "}
        <Link href={otherHref} className="font-medium text-accent hover:underline">
          {isSignUp ? "Masuk" : "Daftar"}
        </Link>
      </p>
    </div>
  );
}
