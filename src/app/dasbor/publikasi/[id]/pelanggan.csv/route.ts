import { asc, eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { getSession } from "@/lib/auth";
import { canManagePublication, getMembership } from "@/server/queries";

export const dynamic = "force-dynamic";

// Cegah CSV injection: sel yang diawali = + - @ diberi tanda kutip tunggal.
function cell(v: string) {
  const safe = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
  return `"${safe.replaceAll('"', '""')}"`;
}

export async function GET(_req: Request, { params }: RouteContext<"/dasbor/publikasi/[id]/pelanggan.csv">) {
  const { id } = await params;
  const session = await getSession();
  if (!session || !canManagePublication(await getMembership(id, session.user.id))) {
    return new Response("Not found", { status: 404 });
  }
  const { subscriptions } = schema;
  const rows = await getDb()
    .select({ email: subscriptions.email, status: subscriptions.status, createdAt: subscriptions.createdAt })
    .from(subscriptions)
    .where(eq(subscriptions.publicationId, id))
    .orderBy(asc(subscriptions.createdAt));

  const lines = rows.map((r) => [cell(r.email), cell(r.status), cell(r.createdAt.toISOString())].join(","));
  const csv = ["email,status,sejak", ...lines].join("\r\n");
  return new Response("﻿" + csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="pelanggan-${id.slice(0, 8)}.csv"`,
      "cache-control": "private, no-store",
    },
  });
}
