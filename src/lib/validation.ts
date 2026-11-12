import { z } from "zod";

// Nama yang tidak boleh dipakai sebagai username / slug publikasi.
const RESERVED = new Set([
  "admin", "administrator", "api", "app", "auth", "dashboard", "dasbor", "daftar", "masuk",
  "keluar", "pengaturan", "settings", "login", "logout", "signup", "register", "u", "p",
  "pub", "post", "posts", "discover", "jelajah", "explore", "quran", "about", "tentang",
  "help", "bantuan", "support", "static", "assets", "_next", "www", "mail", "root",
  "system", "moderator", "official", "resmi", "null", "undefined", "new", "baru",
]);

export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, "Minimal 3 karakter")
  .max(30, "Maksimal 30 karakter")
  .regex(/^[a-z0-9_]+$/, "Hanya huruf kecil, angka, dan garis bawah (_)")
  .refine((v) => !RESERVED.has(v), "Username ini tidak bisa dipakai");

export const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, "Minimal 3 karakter")
  .max(40, "Maksimal 40 karakter")
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Hanya huruf kecil, angka, dan tanda hubung (-)")
  .refine((v) => !RESERVED.has(v), "Alamat ini tidak bisa dipakai");

/** Ubah teks bebas jadi kandidat username: "Ahmad Fauzi" -> "ahmad_fauzi" */
export function toUsernameBase(input: string) {
  const base = input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 20);
  return base.length >= 3 ? base : `user_${base}`.slice(0, 20);
}

/** Ubah teks bebas jadi kandidat slug: "Majelis Tadabbur" -> "majelis-tadabbur" */
export function toSlug(input: string) {
  return input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

/** Ambil pesan error pertama per field dari ZodError. */
export function fieldErrors(error: z.ZodError) {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "_");
    out[key] ??= issue.message;
  }
  return out;
}
