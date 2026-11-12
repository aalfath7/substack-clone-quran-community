"use server";

import { and, eq, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb, schema } from "@/db";
import { requireUser } from "@/lib/auth";
import { fieldErrors, usernameSchema } from "@/lib/validation";

export type ProfileState = {
  ok?: boolean;
  message?: string;
  errors?: Record<string, string>;
};

const profileSchema = z.object({
  name: z.string().trim().min(1, "Nama wajib diisi").max(80, "Maksimal 80 karakter"),
  username: usernameSchema,
  bio: z.string().trim().max(300, "Maksimal 300 karakter"),
});

export async function updateProfile(_prev: ProfileState, formData: FormData): Promise<ProfileState> {
  const user = await requireUser("/pengaturan");

  const parsed = profileSchema.safeParse({
    name: formData.get("name") ?? "",
    username: formData.get("username") ?? "",
    bio: formData.get("bio") ?? "",
  });
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

  const { name, username, bio } = parsed.data;

  // Avatar: hasil upload R2, atau gambar lama (mis. dari Google) yang tidak diubah, atau kosong.
  const imageInput = String(formData.get("image") ?? "");
  const image =
    imageInput === "" ? null : /^\/media\/avatar\/[0-9a-f-]{36}\.(jpg|png|webp)$/.test(imageInput) || imageInput === user.image ? imageInput : undefined;
  if (image === undefined) return { errors: { image: "Gambar tidak valid" } };
  const db = getDb();

  const taken = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(and(eq(schema.users.username, username), ne(schema.users.id, user.id)))
    .get();
  if (taken) return { errors: { username: "Username sudah dipakai" } };

  await db
    .update(schema.users)
    .set({ name, username, bio: bio || null, image })
    .where(eq(schema.users.id, user.id));

  if (user.username && user.username !== username) revalidatePath(`/u/${user.username}`);
  revalidatePath(`/u/${username}`);
  return { ok: true, message: "Profil tersimpan." };
}
