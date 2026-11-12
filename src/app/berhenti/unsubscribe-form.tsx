"use client";

import { useState, useTransition } from "react";
import { Button, FormMessage } from "@/components/ui";
import { unsubscribeByToken } from "@/server/community";

export function UnsubscribeForm({ token }: { token: string }) {
  const [result, setResult] = useState<{ ok?: boolean; message?: string } | null>(null);
  const [pending, start] = useTransition();
  if (result) return <FormMessage ok={result.ok}>{result.message}</FormMessage>;
  return (
    <Button disabled={pending} onClick={() => start(async () => setResult(await unsubscribeByToken(token)))}>
      {pending ? "Memproses…" : "Ya, berhenti berlangganan"}
    </Button>
  );
}
