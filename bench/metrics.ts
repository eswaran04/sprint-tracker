import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

/**
 * Metric files written by the quality/reliability evals (and, in the same JSON shape, by `bench/live/*.mjs`).
 * `scripts/bench-report.mjs` reads every `bench/results/metrics/*.json` into the report's scorecard.
 */

export interface Metric {
  /** Stable id, used to compare against the baseline. */
  id: string;
  label: string;
  /** null = not measurable in this run (explained in `note`). */
  value: number | null;
  unit: "ms" | "%" | "count" | "req/s" | "score" | "KB";
  /** Pass/fail threshold; omitted for informational metrics. */
  budget?: number;
  better: "lower" | "higher";
  note?: string;
}

export interface MetricFile {
  /** Scorecard section, e.g. "Sprint generation". */
  section: string;
  /** Short description of how the numbers were produced. */
  method: string;
  /** Budget breaches fail `npm run bench:check` only when true (offline, deterministic metrics). */
  gate: boolean;
  generatedAt: string;
  context?: Record<string, string | number | boolean>;
  metrics: Metric[];
  /** Optional detail rows (per prompt / per golden item / per step), rendered as a table. */
  details?: { columns: string[]; rows: (string | number)[][] };
}

export const METRICS_DIR = "bench/results/metrics";

export function writeMetrics(name: string, data: Omit<MetricFile, "generatedAt">) {
  mkdirSync(METRICS_DIR, { recursive: true });
  const file = path.join(METRICS_DIR, `${name}.json`);
  writeFileSync(file, JSON.stringify({ ...data, generatedAt: new Date().toISOString() }, null, 2));
  return file;
}

/** Nearest-rank percentile (p in 0..100). */
export function percentile(xs: number[], p: number) {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.max(0, Math.ceil((p / 100) * s.length) - 1))];
}

export const pct = (n: number, d: number) => (d ? Math.round((n / d) * 1000) / 10 : 0);
export const round = (n: number, dp = 2) => Math.round(n * 10 ** dp) / 10 ** dp;

/** Times `fn` `runs` times (after `warmup` untimed runs) and returns per-run durations in ms. */
export async function sample(fn: () => unknown, runs: number, warmup = 3) {
  for (let i = 0; i < warmup; i++) await fn();
  const out: number[] = [];
  for (let i = 0; i < runs; i++) {
    const t = performance.now();
    await fn();
    out.push(performance.now() - t);
  }
  return out;
}
