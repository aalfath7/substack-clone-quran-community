import type { Metadata, Viewport } from "next";
import { Amiri, Inter, Source_Serif_4 } from "next/font/google";
import { SiteHeader } from "@/components/site-header";
import { ServiceWorkerRegister } from "@/components/sw-register";
import "./globals.css";

const sans = Inter({ variable: "--font-inter", subsets: ["latin"] });
const serif = Source_Serif_4({ variable: "--font-source-serif", subsets: ["latin"] });
const arabic = Amiri({
  variable: "--font-amiri",
  subsets: ["arabic"],
  weight: ["400", "700"],
});

export const metadata: Metadata = {
  title: {
    default: "Quran Community",
    template: "%s · Quran Community",
  },
  description: "Tempat menulis dan berbagi tadabbur, kajian, dan catatan hafalan Al-Qur'an.",
  metadataBase: new URL(process.env.APP_URL || "http://localhost:3000"),
  appleWebApp: { capable: true, title: "QuranKom", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fdfcf8" },
    { media: "(prefers-color-scheme: dark)", color: "#121211" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="id"
      className={`${sans.variable} ${serif.variable} ${arabic.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-background font-sans text-foreground">
        <ServiceWorkerRegister />
        <SiteHeader />
        <div className="flex flex-1 flex-col">{children}</div>
        <footer className="border-t border-border py-6 text-center text-sm text-muted">
          Quran Community
        </footer>
      </body>
    </html>
  );
}
