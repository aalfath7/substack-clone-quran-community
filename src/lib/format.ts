const dateFmt = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "long", year: "numeric" });
const shortFmt = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short" });
const rtf = new Intl.RelativeTimeFormat("id-ID", { numeric: "auto" });

export function formatDate(d: Date | null | undefined) {
  return d ? dateFmt.format(d) : "";
}

/** "5 menit yang lalu", "kemarin", atau tanggal jika > 7 hari. */
export function timeAgo(d: Date) {
  const diff = (d.getTime() - Date.now()) / 1000;
  const abs = Math.abs(diff);
  if (abs < 60) return "baru saja";
  if (abs < 3600) return rtf.format(Math.round(diff / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), "hour");
  if (abs < 7 * 86400) return rtf.format(Math.round(diff / 86400), "day");
  return d.getFullYear() === new Date().getFullYear() ? shortFmt.format(d) : dateFmt.format(d);
}

/** Tanggal `days` hari yang lalu dari sekarang. */
export function daysAgo(days: number) {
  return new Date(Date.now() - days * 86400_000);
}
