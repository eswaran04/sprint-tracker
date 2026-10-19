#!/usr/bin/env node
/**
 * Turns `bench/results/**.json` (written by `npm run bench`) into `bench/REPORT.md`.
 *
 *   node scripts/bench-report.mjs                  # write report, compare against bench/baseline if present
 *   node scripts/bench-report.mjs --save-baseline  # also copy current results to bench/baseline/
 *   node scripts/bench-report.mjs --check          # exit 1 on a budget breach or regression (CI)
 */
import { execSync } from "node:child_process";
import { cpSync, existsSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const RESULTS = path.join(ROOT, "bench/results");
const BASELINE = path.join(ROOT, "bench/baseline");
const REPORT = path.join(ROOT, "bench/REPORT.md");
const args = new Set(process.argv.slice(2));

/**
 * Mean-latency budgets (ms), flat or per problem count. Interactive work must fit one 60fps frame; import is a
 * one-off action; rescheduling is a server round-trip (≤ 100 ms for typical sheets, ≤ 1 s at 10k problems).
 */
const BUDGET_MS = { filters: 16, stats: 16, schedule: 16, import: 1000, reschedule: (size) => (size <= 2000 ? 100 : 1000) };
const budgetFor = (group, size) => {
  const b = BUDGET_MS[group];
  return typeof b === "function" ? b(size) : (b ?? Infinity);
};
const budgetLabel = (g, b) => (typeof b === "function" ? `${g} ≤ ${b(2000)} ms (≤ ${b(10000)} ms at 10k)` : `${g} ≤ ${b} ms`);
/** Directory under bench/results holding quality/reliability metric files (not tinybench output). */
const METRICS = "metrics";
/** A slowdown counts as a regression only beyond this and beyond both runs' margin of error. */
const REGRESSION_PCT = 10;

function load(dir) {
  const out = new Map();
  if (!existsSync(dir)) return out;
  for (const group of readdirSync(dir, { withFileTypes: true })) {
    if (!group.isDirectory() || group.name === METRICS) continue;
    for (const file of readdirSync(path.join(dir, group.name))) {
      if (!file.endsWith(".json")) continue;
      const [name, size] = file.slice(0, -5).split("@");
      const data = JSON.parse(readFileSync(path.join(dir, group.name, file), "utf8"));
      out.set(`${group.name}/${name}@${size}`, { group: group.name, name, size: Number(size), ...data });
    }
  }
  return out;
}

const ms = (v) => (v >= 100 ? v.toFixed(0) : v >= 1 ? v.toFixed(2) : v.toFixed(3));
const ops = (v) => Math.round(v).toLocaleString("en-US");
const git = (cmd) => {
  try {
    return execSync(`git ${cmd}`, { cwd: ROOT, stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
  } catch {
    return "n/a";
  }
};

/** Reads `<dir>/metrics/*.json` (written by `bench/metrics.ts`) keyed by file name. */
function loadMetrics(dir) {
  const out = new Map();
  const mdir = path.join(dir, METRICS);
  if (!existsSync(mdir)) return out;
  for (const file of readdirSync(mdir).sort()) {
    if (file.endsWith(".json")) out.set(file.slice(0, -5), JSON.parse(readFileSync(path.join(mdir, file), "utf8")));
  }
  return out;
}

const current = load(RESULTS);
const metrics = loadMetrics(RESULTS);
if (!current.size && !metrics.size) {
  console.error("No benchmark results found. Run `npm run bench` or `npm run bench:quality` first.");
  process.exit(1);
}
const baseline = load(BASELINE);
const baselineMetrics = new Map(
  [...loadMetrics(BASELINE).values()].flatMap((f) => f.metrics.map((m) => [m.id, m])),
);
const failures = [];

const lines = [
  "# Performance Report",
  "",
  `Generated ${new Date().toISOString()} · commit \`${git("rev-parse --short HEAD")}\`${git("status --porcelain") ? " (dirty)" : ""}`,
  "",
  `Environment: Node ${process.version} · ${os.cpus()[0]?.model ?? "unknown CPU"} (${os.cpus().length} cores) · ${os.platform()} ${os.release()}`,
  "",
  `Budgets (mean latency): ${Object.entries(BUDGET_MS).map(([g, b]) => budgetLabel(g, b)).join(", ")}. ` +
    `Regression threshold: +${REGRESSION_PCT}% vs baseline and outside the margin of error.` +
    (baseline.size ? "" : " _No baseline saved yet — run `npm run bench:baseline` to create one._"),
  "",
];

const groups = [...new Set([...current.values()].map((r) => r.group))].sort();
for (const group of groups) {
  const rows = [...current.values()]
    .filter((r) => r.group === group)
    .sort((a, b) => a.name.localeCompare(b.name) || a.size - b.size);
  lines.push(
    `## ${group}`,
    "",
    "| Benchmark | Size | Mean (ms) | p99 (ms) | ops/s | ±RME | Baseline (ms) | Δ | Status |",
    "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |",
  );
  for (const r of rows) {
    const key = `${group}/${r.name}@${r.size}`;
    const base = baseline.get(key);
    const budget = budgetFor(group, r.size);
    const status = [];
    if (r.latency.mean > budget) {
      status.push("🔴 over budget");
      failures.push(`${key}: ${ms(r.latency.mean)} ms > ${budget} ms budget`);
    }
    let delta = "—";
    if (base) {
      const pct = ((r.latency.mean - base.latency.mean) / base.latency.mean) * 100;
      delta = `${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%`;
      const noise = r.latency.rme + base.latency.rme;
      if (pct > REGRESSION_PCT && pct > noise) {
        status.push("🟠 regression");
        failures.push(`${key}: ${delta} slower than baseline`);
      } else if (pct < -REGRESSION_PCT && -pct > noise) status.push("🟢 faster");
    }
    lines.push(
      `| ${r.name} | ${r.size.toLocaleString("en-US")} | ${ms(r.latency.mean)} | ${ms(r.latency.p99)} | ${ops(r.throughput.mean)} | ±${r.latency.rme.toFixed(1)}% | ${base ? ms(base.latency.mean) : "—"} | ${delta} | ${status.join(" ") || "✅"} |`,
    );
  }
  lines.push("");
}

// ---- Quality / reliability scorecard (bench/results/metrics/*.json) ----
const warnings = [];
const fmtVal = (v, unit) => (v === null || v === undefined ? "n/a" : unit === "%" ? `${v}%` : `${v} ${unit}`);
const breaches = (m) =>
  m.value !== null && m.budget !== undefined && (m.better === "lower" ? m.value > m.budget : m.value < m.budget);
const SECTION_ORDER = ["Sprint generation", "AI note review", "Reliability"];
const metricFiles = [...metrics.entries()].sort(
  ([, a], [, b]) => ((SECTION_ORDER.indexOf(a.section) + 1 || 99) - (SECTION_ORDER.indexOf(b.section) + 1 || 99)),
);
for (const [name, f] of metricFiles) {
  lines.push(
    `## ${f.section}`,
    "",
    `_${f.method}_`,
    "",
    `Source: \`bench/results/${METRICS}/${name}.json\` · ${f.gate ? "gated in `bench:check`" : "informational (warnings only)"}`,
    "",
    "| Metric | Value | Target | Baseline | Status |",
    "| --- | ---: | ---: | ---: | --- |",
  );
  for (const m of f.metrics) {
    const base = baselineMetrics.get(m.id);
    const target = m.budget === undefined ? "—" : `${m.better === "lower" ? "≤" : "≥"} ${fmtVal(m.budget, m.unit)}`;
    let status = m.budget === undefined ? "ℹ️" : "✅";
    if (m.value === null) status = "⚪ not measured";
    else if (breaches(m)) {
      status = f.gate ? "🔴 below target" : "🟡 below target";
      (f.gate ? failures : warnings).push(`${f.section} · ${m.label}: ${fmtVal(m.value, m.unit)} (target ${target})`);
    }
    lines.push(
      `| ${m.label}${m.note ? ` _(${m.note})_` : ""} | ${fmtVal(m.value, m.unit)} | ${target} | ${base ? fmtVal(base.value, base.unit) : "—"} | ${status} |`,
    );
  }
  if (f.details?.rows?.length) {
    lines.push(
      "",
      "<details><summary>Details</summary>",
      "",
      `| ${f.details.columns.join(" | ")} |`,
      `| ${f.details.columns.map(() => "---").join(" | ")} |`,
      ...f.details.rows.map((r) => `| ${r.map((c) => String(c).replaceAll("|", "\\|")).join(" | ")} |`),
      "",
      "</details>",
    );
  }
  lines.push("");
}

lines.push(
  "## Findings",
  "",
  failures.length ? failures.map((f) => `- ${f}`).join("\n") : "- All benchmarks within budget and no regressions.",
  ...warnings.map((w) => `- ⚠️ ${w}`),
  "",
);
writeFileSync(REPORT, lines.join("\n"));
console.log(`Wrote ${path.relative(ROOT, REPORT)} (${current.size} timing results, ${metrics.size} metric files, ${baseline.size} baseline entries).`);

if (args.has("--save-baseline")) {
  rmSync(BASELINE, { recursive: true, force: true });
  cpSync(RESULTS, BASELINE, { recursive: true });
  console.log(`Saved baseline to ${path.relative(ROOT, BASELINE)}/`);
}
if (failures.length) {
  console.warn(`\n${failures.length} issue(s):\n${failures.map((f) => `  - ${f}`).join("\n")}`);
  if (args.has("--check")) process.exit(1);
}
