import { defineConfig } from "vitest/config";

// Integration tests against a real Postgres (DATABASE_URL, migrated with `npm run db:migrate`).
export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    environment: "node",
    include: ["db/**/*.db.test.ts"],
    fileParallelism: false,
  },
});
