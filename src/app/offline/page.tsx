import type { Metadata } from "next";

export const metadata: Metadata = { title: "Offline", robots: { index: false } };

export default function OfflinePage() {
  return (
    <main className="mx-auto w-full max-w-md flex-1 px-4 py-20 text-center">
      <h1 className="font-serif text-3xl font-semibold">Anda sedang offline</h1>
      <p className="mt-3 text-muted">
        Halaman ini belum tersimpan. Tulisan yang pernah Anda buka sebelumnya tetap bisa dibaca tanpa koneksi.
      </p>
    </main>
  );
}
