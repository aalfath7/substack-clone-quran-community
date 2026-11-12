import { sql } from "drizzle-orm";
import { getDb } from "@/db";

// Cek cepat bahwa Worker bisa membaca D1. GET /api/health
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const db = getDb();
    const rows = await db.all<{ name: string }>(
      sql`SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT GLOB '_*' AND name NOT GLOB 'sqlite_*' AND name NOT GLOB 'd1_*' ORDER BY name`,
    );
    return Response.json({ ok: true, db: "d1", tables: rows.map((r) => r.name) });
  } catch (error) {
    console.error("health check gagal", error);
    return Response.json({ ok: false, error: "D1 tidak bisa diakses" }, { status: 500 });
  }
}
