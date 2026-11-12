"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function PubTabs({ id, canManage }: { id: string; canManage: boolean }) {
  const pathname = usePathname();
  const base = `/dasbor/publikasi/${id}`;
  const tabs = [
    { href: base, label: "Tulisan" },
    ...(canManage
      ? [
          { href: `${base}/pelanggan`, label: "Pelanggan" },
          { href: `${base}/statistik`, label: "Statistik" },
          { href: `${base}/pengaturan`, label: "Pengaturan" },
        ]
      : []),
  ];
  return (
    <nav className="flex gap-1 overflow-x-auto border-b border-border" aria-label="Menu publikasi">
      {tabs.map((t) => {
        const active = pathname === t.href;
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={active ? "page" : undefined}
            className={`-mb-px border-b-2 px-3 py-2 text-sm whitespace-nowrap ${
              active ? "border-accent font-medium" : "border-transparent text-muted hover:text-foreground"
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
