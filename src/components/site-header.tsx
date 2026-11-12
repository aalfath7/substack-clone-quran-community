"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { signOut, useSession } from "@/lib/auth-client";
import { Avatar, buttonClass } from "./ui";

export function SiteHeader() {
  const { data: session, isPending } = useSession();

  return (
    <header className="border-b border-border">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-4 px-4">
        <Link href="/" className="font-serif text-lg font-semibold">
          Quran Community
        </Link>

        <nav className="flex items-center gap-1 sm:gap-2">
          <Link href="/jelajah" className={buttonClass("ghost", "hidden sm:inline-flex")}>
            Jelajah
          </Link>
          <Link href="/catatan" className={buttonClass("ghost", "hidden sm:inline-flex")}>
            Catatan
          </Link>
          {isPending ? (
            <span className="h-8 w-20" />
          ) : session ? (
            <>
              <Link href="/dasbor" className={buttonClass("ghost", "hidden sm:inline-flex")}>
                Dasbor
              </Link>
              <UserMenu
                name={session.user.name}
                image={session.user.image}
                username={session.user.username}
                isAdmin={session.user.role === "admin"}
              />
            </>
          ) : (
            <>
              <Link href="/masuk" className={buttonClass("ghost")}>
                Masuk
              </Link>
              <Link href="/daftar" className={buttonClass("primary")}>
                Daftar
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}

function UserMenu({
  name,
  image,
  username,
  isAdmin,
}: {
  name: string;
  image?: string | null;
  username?: string | null;
  isAdmin?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  const item = "block w-full px-3 py-2 text-left text-sm hover:bg-foreground/5";

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Menu akun"
        onClick={() => setOpen((v) => !v)}
        className="rounded-full focus:ring-2 focus:ring-accent/30 focus:outline-none"
      >
        <Avatar name={name} image={image} />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 z-20 mt-2 w-52 overflow-hidden rounded-md border border-border bg-background py-1 shadow-lg"
        >
          <div className="border-b border-border px-3 py-2">
            <p className="truncate text-sm font-medium">{name}</p>
            {username && <p className="truncate text-xs text-muted">@{username}</p>}
          </div>
          {username && (
            <Link role="menuitem" href={`/u/${username}`} className={item} onClick={() => setOpen(false)}>
              Profil saya
            </Link>
          )}
          <Link role="menuitem" href="/dasbor" className={item} onClick={() => setOpen(false)}>
            Dasbor
          </Link>
          <Link role="menuitem" href="/tersimpan" className={item} onClick={() => setOpen(false)}>
            Tersimpan
          </Link>
          <Link role="menuitem" href="/jelajah" className={`${item} sm:hidden`} onClick={() => setOpen(false)}>
            Jelajah
          </Link>
          <Link role="menuitem" href="/catatan" className={`${item} sm:hidden`} onClick={() => setOpen(false)}>
            Catatan
          </Link>
          <Link role="menuitem" href="/pengaturan" className={item} onClick={() => setOpen(false)}>
            Pengaturan
          </Link>
          {isAdmin && (
            <Link role="menuitem" href="/admin" className={item} onClick={() => setOpen(false)}>
              Admin
            </Link>
          )}
          <button
            role="menuitem"
            type="button"
            className={`${item} text-red-600 dark:text-red-400`}
            onClick={async () => {
              await signOut();
              setOpen(false);
              router.push("/");
              router.refresh();
            }}
          >
            Keluar
          </button>
        </div>
      )}
    </div>
  );
}
