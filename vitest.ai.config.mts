import { defineConfig } from "vitest/config";

// Live evals against Vertex AI (ADC credentials required). Not part of CI: `npm run test:ai`.
export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    environment: "node",
    include: ["src/**/*.eval.ts"],
  },
});
