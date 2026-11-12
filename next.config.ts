import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

const nextConfig: NextConfig = {
  // Cache Components dimatikan: di runtime Workers (OpenNext) render-nya menggantung
  // karena perilaku setTimeout workerd. Pakai model caching klasik (revalidate, dynamic).
  // URL publik publikasi /@slug dilayani route /pub/[slug].
  // (Folder "@..." di App Router berarti parallel route, jadi tidak bisa dipakai langsung.)
  async rewrites() {
    return [
      { source: "/@:slug", destination: "/pub/:slug" },
      { source: "/@:slug/:path*", destination: "/pub/:slug/:path*" },
    ];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;

// Agar `getCloudflareContext()` (D1, env) tersedia saat `next dev`.
initOpenNextCloudflareForDev();
