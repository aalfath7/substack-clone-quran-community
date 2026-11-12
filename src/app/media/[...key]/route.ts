import { getCloudflareContext } from "@opennextjs/cloudflare";

export const dynamic = "force-dynamic";

/** Sajikan gambar dari R2: GET /media/<kind>/<uuid>.<ext> */
export async function GET(request: Request, { params }: RouteContext<"/media/[...key]">) {
  const { key } = await params;
  const path = key.join("/");
  if (!/^(avatar|cover|logo|image)\/[0-9a-f-]{36}\.(jpg|png|webp)$/.test(path)) {
    return new Response("Not found", { status: 404 });
  }

  const { env } = getCloudflareContext();
  const obj = await env.MEDIA.get(path, { onlyIf: request.headers });
  if (!obj) return new Response("Not found", { status: 404 });

  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  headers.set("etag", obj.httpEtag);
  headers.set("cache-control", "public, max-age=31536000, immutable");
  headers.set("x-content-type-options", "nosniff");

  // onlyIf terpenuhi (If-None-Match cocok) -> body tidak ada
  if (!("body" in obj) || !obj.body) return new Response(null, { status: 304, headers });
  return new Response(obj.body, { headers });
}
