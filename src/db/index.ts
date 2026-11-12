import "server-only";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

/**
 * Drizzle client untuk D1. Dipanggil per request (binding baru ada di dalam request).
 * Halaman/route yang memakai DB harus dinamis (`export const dynamic = "force-dynamic"`
 * atau memakai cookies/headers) agar query tidak dijalankan saat prerender build.
 */
export function getDb() {
  const { env } = getCloudflareContext();
  return drizzle(env.DB, { schema, casing: "snake_case" });
}

export type Db = ReturnType<typeof getDb>;
export { schema };
