"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb, schema } from "@/db";
import { requireAdmin } from "@/lib/auth";

const { reports, posts, comments, notes } = schema;

/** Tindak lanjuti laporan: sembunyikan konten (dan tutup semua laporan untuk konten itu) atau abaikan. */
export async function resolveReport(reportId: string, action: "hide" | "dismiss") {
  const admin = await requireAdmin();
  const db = getDb();
  const report = await db.select().from(reports).where(eq(reports.id, reportId)).get();
  if (!report || report.status !== "open") return;

  if (action === "hide") {
    if (report.targetType === "post") {
      await db.update(posts).set({ status: "archived" }).where(eq(posts.id, report.targetId));
    } else if (report.targetType === "comment") {
      await db.update(comments).set({ deletedAt: new Date() }).where(eq(comments.id, report.targetId));
    } else {
      await db.update(notes).set({ deletedAt: new Date() }).where(eq(notes.id, report.targetId));
    }
    await db
      .update(reports)
      .set({ status: "resolved", resolvedBy: admin.id, resolvedAt: new Date() })
      .where(
        and(eq(reports.targetType, report.targetType), eq(reports.targetId, report.targetId), eq(reports.status, "open")),
      );
  } else {
    await db
      .update(reports)
      .set({ status: "dismissed", resolvedBy: admin.id, resolvedAt: new Date() })
      .where(eq(reports.id, reportId));
  }
  revalidatePath("/admin");
}
