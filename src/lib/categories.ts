export const POST_CATEGORIES = ["tadabbur", "tafsir", "tajwid", "hafalan", "kajian", "kisah"] as const;
export type PostCategory = (typeof POST_CATEGORIES)[number];

export const CATEGORY_LABEL: Record<PostCategory, string> = {
  tadabbur: "Tadabbur",
  tafsir: "Tafsir",
  tajwid: "Tajwid",
  hafalan: "Hafalan",
  kajian: "Kajian",
  kisah: "Kisah",
};

export function isCategory(v: unknown): v is PostCategory {
  return typeof v === "string" && (POST_CATEGORIES as readonly string[]).includes(v);
}
