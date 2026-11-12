import "server-only";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import { getDb, schema, type Db } from "@/db";
import { hashPassword, verifyPassword } from "./password";
import { toUsernameBase } from "./validation";

async function uniqueUsername(db: Db, seed: string) {
  const base = toUsernameBase(seed);
  for (let i = 0; i < 5; i++) {
    const candidate = i === 0 ? base : `${base}${Math.floor(1000 + Math.random() * 9000)}`;
    const taken = await db
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(eq(schema.users.username, candidate))
      .get();
    if (!taken) return candidate;
  }
  return `${base}${crypto.randomUUID().slice(0, 8)}`;
}

function createAuth() {
  const { env, ctx } = getCloudflareContext();
  const db = getDb();
  const google =
    env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
      ? { google: { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET } }
      : undefined;

  return betterAuth({
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL || undefined,
    database: drizzleAdapter(db, { provider: "sqlite", schema, usePlural: true }),
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 8,
      password: { hash: hashPassword, verify: verifyPassword },
      // Verifikasi email & reset password menyusul saat layanan email siap (Fase 4).
    },
    socialProviders: google,
    user: {
      additionalFields: {
        username: { type: "string", required: false, input: false },
        bio: { type: "string", required: false, input: false },
        role: { type: "string", required: false, input: false, defaultValue: "user" },
      },
    },
    databaseHooks: {
      user: {
        create: {
          before: async (user) => ({
            data: { ...user, username: await uniqueUsername(db, user.name || user.email.split("@")[0]) },
          }),
        },
      },
    },
    // cookieCache sengaja tidak dipakai: perubahan profil (nama/username) harus langsung terlihat.
    advanced: {
      database: { generateId: "uuid" },
      backgroundTasks: { handler: (p) => ctx.waitUntil(p) },
    },
    plugins: [nextCookies()], // harus terakhir
  });
}

export type Auth = ReturnType<typeof createAuth>;

/** Instance Better Auth per request (binding D1 hanya ada di dalam request). */
export const getAuth = cache(createAuth);

/** Sesi saat ini atau null. Dipakai di Server Component / Server Action. */
export const getSession = cache(async () => {
  return getAuth().api.getSession({ headers: await headers() });
});

/** Wajib login; jika belum, arahkan ke /masuk lalu kembali ke `next`. */
export async function requireUser(next?: string) {
  const session = await getSession();
  if (!session) redirect(next ? `/masuk?next=${encodeURIComponent(next)}` : "/masuk");
  return session.user;
}

/** Wajib admin; selain admin mendapat 404 agar halaman admin tidak terlihat. */
export async function requireAdmin() {
  const user = await requireUser("/admin");
  if (user.role !== "admin") notFound();
  return user;
}
