"use client";

import { useActionState } from "react";
import { Button, FormMessage, inputClass } from "@/components/ui";
import { addRecommendation, type PublicationState } from "@/server/publications";

export function RecommendationForm({ publicationId }: { publicationId: string }) {
  const [state, action, pending] = useActionState<PublicationState, FormData>(
    addRecommendation.bind(null, publicationId),
    {},
  );
  return (
    <form action={action} className="space-y-2">
      <label htmlFor="rec-slug" className="block text-sm font-medium">
        Alamat publikasi
      </label>
      <div className="flex gap-2">
        <input id="rec-slug" name="slug" required placeholder="@nama-publikasi" className={inputClass} />
        <Button type="submit" variant="secondary" disabled={pending}>
          Tambah
        </Button>
      </div>
      {state.errors?.slug && <p className="text-sm text-red-600 dark:text-red-400">{state.errors.slug}</p>}
      <FormMessage ok={state.ok}>{state.message}</FormMessage>
    </form>
  );
}
