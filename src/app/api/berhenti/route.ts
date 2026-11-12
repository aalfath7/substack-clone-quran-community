import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";

export const dynamic = "force-dynamic";

/** One-click unsubscribe (RFC 8058) dari header List-Unsubscribe di klien email. */
export async function POST(request: Request) {
  const token = new URL(request.url).searchParams.get("t") ?? "";
  if (!/^[0-9a-f]{64}$/.test(token)) return new Response("Invalid", { status: 400 });
  await getDb()
    .update(schema.subscriptions)
    .set({ status: "unsubscribed" })
    .where(eq(schema.subscriptions.token, token));
  return new Response("OK");
}
