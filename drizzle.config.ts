import { defineConfig } from "drizzle-kit";

// Hanya untuk `drizzle-kit generate`. Migrasi diterapkan lewat wrangler:
//   npm run db:migrate:local / db:migrate:remote
export default defineConfig({
  dialect: "sqlite",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  casing: "snake_case",
});
