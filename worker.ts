// Entry Worker kustom: handler fetch dari OpenNext + consumer Cloudflare Queues untuk email.
// Dibuild oleh wrangler setelah `opennextjs-cloudflare build` (lihat "main" di wrangler.jsonc).
// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- file hasil build bisa ada atau belum
// @ts-ignore -- file hasil build OpenNext, belum ada sebelum build
import { default as openNext } from "./.open-next/worker.js";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "./src/db/schema";
import { sendPostNewsletter, type EmailJob } from "./src/lib/newsletter";

export default {
  fetch: openNext.fetch,

  async queue(batch: MessageBatch<EmailJob>, env: CloudflareEnv) {
    const db = drizzle(env.DB, { schema, casing: "snake_case" });
    for (const msg of batch.messages) {
      try {
        if (msg.body.type === "post-newsletter") {
          const result = await sendPostNewsletter(db, env, msg.body.postId);
          console.log("newsletter", msg.body.postId, result);
        }
        msg.ack();
      } catch (error) {
        console.error("newsletter gagal, dicoba lagi", msg.body, error);
        msg.retry({ delaySeconds: 60 });
      }
    }
  },
} satisfies ExportedHandler<CloudflareEnv, EmailJob>;
