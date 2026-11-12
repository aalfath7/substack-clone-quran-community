/** Hanya izinkan redirect ke path internal ("/..." tapi bukan "//..."), cegah open redirect. */
export function safeNext(value: unknown, fallback = "/dasbor") {
  if (typeof value !== "string") return fallback;
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return fallback;
  return value;
}
