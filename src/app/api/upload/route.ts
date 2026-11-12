import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

const MAX_BYTES = 5 * 1024 * 1024;
const KINDS = new Set(["avatar", "cover", "logo", "image"]);

// Deteksi tipe dari magic bytes, bukan dari nama file / Content-Type kiriman klien.
function sniff(bytes: Uint8Array): { ext: string; type: string } | null {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return { ext: "jpg", type: "image/jpeg" };
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47)
    return { ext: "png", type: "image/png" };
  if (
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  )
    return { ext: "webp", type: "image/webp" };
  return null;
}

/** POST /api/upload (multipart: file, kind) -> { url } */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Harus masuk dulu." }, { status: 401 });

  const len = Number(request.headers.get("content-length") ?? 0);
  if (len > MAX_BYTES + 64 * 1024) return Response.json({ error: "Ukuran maksimal 5 MB." }, { status: 413 });

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ error: "Permintaan tidak valid." }, { status: 400 });
  }
  const file = form.get("file");
  const kind = String(form.get("kind") ?? "image");
  if (!KINDS.has(kind)) return Response.json({ error: "Jenis upload tidak dikenal." }, { status: 400 });
  if (!(file instanceof File)) return Response.json({ error: "File tidak ditemukan." }, { status: 400 });
  if (file.size > MAX_BYTES) return Response.json({ error: "Ukuran maksimal 5 MB." }, { status: 413 });

  const bytes = new Uint8Array(await file.arrayBuffer());
  const detected = sniff(bytes);
  if (!detected) return Response.json({ error: "Hanya JPG, PNG, atau WebP." }, { status: 415 });

  const key = `${kind}/${crypto.randomUUID()}.${detected.ext}`;
  const { env } = getCloudflareContext();
  await env.MEDIA.put(key, bytes, {
    httpMetadata: { contentType: detected.type, cacheControl: "public, max-age=31536000, immutable" },
    customMetadata: { uploadedBy: session.user.id },
  });

  return Response.json({ url: `/media/${key}` });
}
