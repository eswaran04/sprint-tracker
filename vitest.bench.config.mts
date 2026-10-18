import { defineConfig } from "vitest/config";

// Micro-benchmarks for pure `src/lib` hot paths. Node environment (no jsdom overhead) and a
// dedicated include so `npm test` never picks them up. Run with `npm run bench`.
export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    environment: "node",
    include: ["bench/**/*.bench.ts"],
    benchmark: { include: ["bench/**/*.bench.ts"] },
  },
});
