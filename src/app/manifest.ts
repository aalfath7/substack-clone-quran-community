import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Quran Community",
    short_name: "QuranKom",
    description: "Menulis dan berbagi renungan Al-Qur'an.",
    lang: "id",
    start_url: "/",
    display: "standalone",
    background_color: "#fdfcf8",
    theme_color: "#0f6b4f",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/icon-maskable.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" },
    ],
  };
}
