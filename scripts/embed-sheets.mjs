// Backfills/refreshes Vertex AI embeddings for every public sheet (only missing or changed sheets are embedded).
// Uses the app's DB settings (DATABASE_URL or CLOUD_SQL_INSTANCE + DB_*) and ADC credentials:
//   npm run embed:sheets            # all public sheets
//   npm run embed:sheets -- <id>…   # specific sheets
import { fileURLToPath } from "node:url";
import { createJiti } from "jiti";

const src = fileURLToPath(new URL("../src/", import.meta.url));
const jiti = createJiti(import.meta.url, {
  alias: {
    "@/": src,
    // The marker package throws outside a server bundle; this script is server-side by definition.
    "server-only": fileURLToPath(new URL("../node_modules/server-only/empty.js", import.meta.url)),
  },
});

const { ensureSheetEmbeddings } = await jiti.import("../src/lib/ai/embeddings.ts");
const { isAiEnabled } = await jiti.import("../src/lib/ai/vertex.ts");
const { pool } = await jiti.import("../src/lib/db/pool.ts");

if (!isAiEnabled()) {
  console.error("AI is disabled: set GOOGLE_CLOUD_PROJECT and AI_ENABLED != false");
  process.exit(1);
}

const ids = process.argv.slice(2);
try {
  const started = Date.now();
  const r = await ensureSheetEmbeddings({ ids });
  console.log(`embedded ${r.embedded}, unchanged ${r.unchanged}, removed ${r.removed} (${Date.now() - started} ms)`);
} finally {
  await (await pool()).end();
}
