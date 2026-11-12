"use server";

import { and, eq, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getDb, schema } from "@/db";
import { requireUser } from "@/lib/auth";
import { fieldErrors, slugSchema } from "@/lib/validation";
import { canManagePublication, getMembership } from "./queries";

export type PublicationState = {
  ok?: boolean;
  message?: string;
  errors?: Record<string, string>;
};

const publicationSchema = z.object({
  name: z.string().trim().min(2, "Minimal 2 karakter").max(80, "Maksimal 80 karakter"),
  slug: slugSchema,
  tagline: z.string().trim().max(140, "Maksimal 140 karakter"),
  description: z.string().trim().max(2000, "Maksimal 2000 karakter"),
  logoUrl: z.union([z.literal(""), z.string().regex(/^\/media\/logo\/[0-9a-f-]{36}\.(jpg|png|webp)$/, "Logo tidak valid")]),
  supportUrl: z.union([
    z.literal(""),
    z.url({ protocol: /^https$/, message: "Harus tautan https://" }).max(500),
  ]),
  supportText: z.string().trim().max(200, "Maksimal 200 karakter"),
});

function parse(formData: FormData) {
  return publicationSchema.safeParse({
    name: formData.get("name") ?? "",
    slug: formData.get("slug") ?? "",
    tagline: formData.get("tagline") ?? "",
    description: formData.get("description") ?? "",
    logoUrl: formData.get("logoUrl") ?? "",
    supportUrl: String(formData.get("supportUrl") ?? "").trim(),
    supportText: formData.get("supportText") ?? "",
  });
}

async function slugTaken(slug: string, exceptId?: string) {
  const { publications } = schema;
  const row = await getDb()
    .select({ id: publications.id })
    .from(publications)
    .where(exceptId ? and(eq(publications.slug, slug), ne(publications.id, exceptId)) : eq(publications.slug, slug))
    .get();
  return Boolean(row);
}

const MAX_OWNED = 5;

export async function createPublication(
  _prev: PublicationState,
  formData: FormData,
): Promise<PublicationState> {
  const user = await requireUser("/dasbor/publikasi/baru");
  const parsed = parse(formData);
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };
  const data = parsed.data;

  const db = getDb();
  const owned = await db.$count(schema.publications, eq(schema.publications.ownerId, user.id));
  if (owned >= MAX_OWNED) {
    return { message: `Maksimal ${MAX_OWNED} publikasi per akun.` };
  }
  if (await slugTaken(data.slug)) return { errors: { slug: "Alamat ini sudah dipakai" } };

  const id = crypto.randomUUID();
  try {
    await db.batch([
      db.insert(schema.publications).values({
        id,
        ownerId: user.id,
        slug: data.slug,
        name: data.name,
        tagline: data.tagline || null,
        description: data.description || null,
      }),
      db.insert(schema.publicationMembers).values({ publicationId: id, userId: user.id, role: "owner" }),
    ]);
  } catch (error) {
    // Balapan dua request dengan slug sama: kena UNIQUE constraint.
    if (String(error).includes("UNIQUE")) return { errors: { slug: "Alamat ini sudah dipakai" } };
    throw error;
  }

  revalidatePath("/dasbor");
  if (user.username) revalidatePath(`/u/${user.username}`);
  redirect(`/dasbor/publikasi/${id}?baru=1`);
}

export async function updatePublication(
  publicationId: string,
  _prev: PublicationState,
  formData: FormData,
): Promise<PublicationState> {
  const user = await requireUser(`/dasbor/publikasi/${publicationId}`);
  const role = await getMembership(publicationId, user.id);
  if (!canManagePublication(role)) return { message: "Anda tidak punya akses untuk mengubah publikasi ini." };

  const parsed = parse(formData);
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };
  const data = parsed.data;

  if (await slugTaken(data.slug, publicationId)) return { errors: { slug: "Alamat ini sudah dipakai" } };

  const db = getDb();
  const before = await db
    .select({ slug: schema.publications.slug })
    .from(schema.publications)
    .where(eq(schema.publications.id, publicationId))
    .get();

  try {
    await db
      .update(schema.publications)
      .set({
        name: data.name,
        slug: data.slug,
        tagline: data.tagline || null,
        description: data.description || null,
        logoUrl: data.logoUrl || null,
        supportUrl: data.supportUrl || null,
        supportText: data.supportText || null,
      })
      .where(eq(schema.publications.id, publicationId));
  } catch (error) {
    if (String(error).includes("UNIQUE")) return { errors: { slug: "Alamat ini sudah dipakai" } };
    throw error;
  }

  if (before) revalidatePath(`/pub/${before.slug}`);
  revalidatePath(`/pub/${data.slug}`);
  revalidatePath("/dasbor");
  return { ok: true, message: "Perubahan tersimpan." };
}

// ─── Rekomendasi (#14) ──────────────────────────────────────────────────────

export async function addRecommendation(
  publicationId: string,
  _prev: PublicationState,
  formData: FormData,
): Promise<PublicationState> {
  const user = await requireUser(`/dasbor/publikasi/${publicationId}/pengaturan`);
  if (!canManagePublication(await getMembership(publicationId, user.id))) return { message: "Tidak punya akses." };

  const slug = String(formData.get("slug") ?? "").trim().replace(/^\/?@/, "").toLowerCase();
  const db = getDb();
  const target = await db
    .select({ id: schema.publications.id, slug: schema.publications.slug })
    .from(schema.publications)
    .where(eq(schema.publications.slug, slug))
    .get();
  if (!target) return { errors: { slug: "Publikasi tidak ditemukan" } };
  if (target.id === publicationId) return { errors: { slug: "Tidak bisa merekomendasikan diri sendiri" } };

  const current = await db.$count(schema.recommendations, eq(schema.recommendations.publicationId, publicationId));
  if (current >= 12) return { message: "Maksimal 12 rekomendasi." };

  await db
    .insert(schema.recommendations)
    .values({ publicationId, recommendedPublicationId: target.id })
    .onConflictDoNothing();
  await revalidatePub(publicationId);
  return { ok: true, message: `@${target.slug} ditambahkan.` };
}

export async function removeRecommendation(publicationId: string, recommendedId: string) {
  const user = await requireUser(`/dasbor/publikasi/${publicationId}/pengaturan`);
  if (!canManagePublication(await getMembership(publicationId, user.id))) return;
  await getDb()
    .delete(schema.recommendations)
    .where(
      and(
        eq(schema.recommendations.publicationId, publicationId),
        eq(schema.recommendations.recommendedPublicationId, recommendedId),
      ),
    );
  await revalidatePub(publicationId);
}

async function revalidatePub(publicationId: string) {
  const pub = await getDb()
    .select({ slug: schema.publications.slug })
    .from(schema.publications)
    .where(eq(schema.publications.id, publicationId))
    .get();
  if (pub) revalidatePath(`/pub/${pub.slug}`);
  revalidatePath(`/dasbor/publikasi/${publicationId}/pengaturan`);
}
