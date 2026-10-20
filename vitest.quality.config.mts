import { defineConfig } from "vitest/config";

// Offline quality + reliability benchmarks (sprint generation, note review, fault injection). They call the
// production `src/lib` code with AI off or a fake in-process LLM, so they never hit the network or cost money.
// Run with `npm run bench:quality`; results go to bench/results/metrics/.
export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    environment: "node",
    include: ["bench/quality/**/*.quality.ts"],
    fileParallelism: false,
    testTimeout: 300_000,
    env: { AI_ENABLED: "false" },
  },
});
