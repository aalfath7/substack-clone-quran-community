import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { getDb, schema } from "@/db";
import { requireUser } from "@/lib/auth";
import { removeRecommendation, updatePublication } from "@/server/publications";
import { canManagePublication, getMembership, getPublicationById } from "@/server/queries";
import { PublicationForm } from "../../../publication-form";
import { RecommendationForm } from "./recommendation-form";

export const metadata: Metadata = { title: "Pengaturan publikasi" };
export const dynamic = "force-dynamic";

export default async function PublicationSettingsPage({ params }: PageProps<"/dasbor/publikasi/[id]/pengaturan">) {
  const { id } = await params;
  const user = await requireUser(`/dasbor/publikasi/${id}/pengaturan`);
  if (!canManagePublication(await getMembership(id, user.id))) notFound();
  const pub = await getPublicationById(id);
  if (!pub) notFound();

  const recs = await getDb()
    .select({ id: schema.publications.id, slug: schema.publications.slug, name: schema.publications.name })
    .from(schema.recommendations)
    .innerJoin(schema.publications, eq(schema.publications.id, schema.recommendations.recommendedPublicationId))
    .where(eq(schema.recommendations.publicationId, id));

  return (
    <div className="max-w-xl space-y-14">
      <section>
        <h2 className="mb-6 text-lg font-semibold">Profil publikasi</h2>
        <PublicationForm
          action={updatePublication.bind(null, pub.id)}
          submitLabel="Simpan perubahan"
          defaults={{
            name: pub.name,
            slug: pub.slug,
            tagline: pub.tagline ?? "",
            description: pub.description ?? "",
            logoUrl: pub.logoUrl ?? "",
            supportUrl: pub.supportUrl ?? "",
            supportText: pub.supportText ?? "",
          }}
        />
      </section>

      <section>
        <h2 className="mb-1 text-lg font-semibold">Rekomendasi</h2>
        <p className="mb-4 text-sm text-muted">
          Publikasi lain yang Anda rekomendasikan tampil di halaman publikasi Anda.
        </p>
        {recs.length > 0 && (
          <ul className="mb-4 divide-y divide-border rounded-lg border border-border">
            {recs.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <span className="min-w-0 truncate">
                  {r.name} <span className="text-sm text-muted">/@{r.slug}</span>
                </span>
                <form action={removeRecommendation.bind(null, pub.id, r.id)}>
                  <button type="submit" className="text-sm text-red-600 hover:underline dark:text-red-400">
                    Hapus
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
        <RecommendationForm publicationId={pub.id} />
      </section>
    </div>
  );
}
