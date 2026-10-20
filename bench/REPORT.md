# Performance Report

Generated 2026-10-18T14:04:48.416Z · commit `f7d155f` (dirty)

Environment: Node v24.6.0 · Apple M3 (8 cores) · darwin 25.6.0

Budgets (mean latency): filters ≤ 16 ms, stats ≤ 16 ms, schedule ≤ 16 ms, import ≤ 1000 ms, reschedule ≤ 100 ms (≤ 1000 ms at 10k). Regression threshold: +10% vs baseline and outside the margin of error.

## filters

| Benchmark | Size | Mean (ms) | p99 (ms) | ops/s | ±RME | Baseline (ms) | Δ | Status |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| applyFilters-combined | 500 | 0.004 | 0.011 | 281,877 | ±0.9% | 0.004 | +3.3% | ✅ |
| applyFilters-combined | 2,000 | 0.020 | 0.070 | 64,580 | ±19.4% | 0.017 | +19.2% | ✅ |
| applyFilters-combined | 10,000 | 0.080 | 0.208 | 12,972 | ±1.0% | 0.085 | -5.9% | ✅ |
| applyFilters-default | 500 | 0.012 | 0.028 | 85,811 | ±0.7% | 0.013 | -6.4% | ✅ |
| applyFilters-default | 2,000 | 0.050 | 0.168 | 21,263 | ±1.7% | 0.050 | +0.4% | ✅ |
| applyFilters-default | 10,000 | 0.223 | 0.431 | 4,583 | ±1.1% | 0.271 | -17.7% | 🟢 faster |
| applyFilters-search | 500 | 0.067 | 0.153 | 15,214 | ±0.8% | 0.072 | -6.3% | ✅ |
| applyFilters-search | 2,000 | 0.348 | 1.25 | 3,338 | ±11.2% | 0.301 | +15.8% | 🟠 regression |
| applyFilters-search | 10,000 | 1.67 | 2.78 | 610 | ±2.5% | 1.72 | -2.7% | ✅ |
| applyFilters-sortName | 500 | 2.43 | 5.86 | 477 | ±8.0% | 1.74 | +40.1% | 🟠 regression |
| applyFilters-sortName | 2,000 | 5.93 | 7.36 | 169 | ±1.8% | 6.08 | -2.5% | ✅ |
| applyFilters-sortName | 10,000 | 30.52 | 57.86 | 33 | ±4.6% | 30.86 | -1.1% | 🔴 over budget |
| facets | 500 | 0.096 | 0.263 | 11,546 | ±6.4% | 0.093 | +3.0% | ✅ |
| facets | 2,000 | 0.377 | 0.585 | 2,918 | ±11.9% | 0.492 | -23.5% | ✅ |
| facets | 10,000 | 2.09 | 14.15 | 563 | ±22.2% | 1.97 | +6.3% | ✅ |
| statusCounts | 500 | 0.134 | 0.306 | 7,673 | ±1.1% | 0.137 | -2.2% | ✅ |
| statusCounts | 2,000 | 0.568 | 0.915 | 1,785 | ±1.2% | 1.00 | -43.2% | 🟢 faster |
| statusCounts | 10,000 | 2.95 | 3.56 | 341 | ±1.5% | 2.98 | -1.1% | ✅ |

## import

| Benchmark | Size | Mean (ms) | p99 (ms) | ops/s | ±RME | Baseline (ms) | Δ | Status |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| end-to-end | 500 | 7.28 | 10.32 | 140 | ±2.8% | 7.27 | +0.1% | ✅ |
| end-to-end | 2,000 | 28.39 | 33.30 | 35 | ±1.3% | 31.18 | -8.9% | ✅ |
| end-to-end | 10,000 | 169 | 294 | 6 | ±5.1% | 171 | -1.0% | ✅ |
| parseWorkbook | 500 | 9.06 | 45.70 | 127 | ±13.0% | 6.70 | +35.3% | 🟠 regression |
| parseWorkbook | 2,000 | 29.71 | 34.69 | 34 | ±1.7% | 28.80 | +3.2% | ✅ |
| parseWorkbook | 10,000 | 150 | 252 | 7 | ±4.6% | 163 | -8.0% | ✅ |
| toProblems | 500 | 0.245 | 0.498 | 4,213 | ±0.9% | 0.232 | +5.2% | ✅ |
| toProblems | 2,000 | 0.967 | 1.57 | 1,048 | ±0.9% | 0.971 | -0.3% | ✅ |
| toProblems | 10,000 | 4.97 | 6.69 | 203 | ±1.6% | 5.11 | -2.8% | ✅ |

## reschedule

| Benchmark | Size | Mean (ms) | p99 (ms) | ops/s | ±RME | Baseline (ms) | Δ | Status |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| coachInputs | 500 | 1.47 | 3.18 | 721 | ±4.0% | — | — | ✅ |
| coachInputs | 2,000 | 5.75 | 8.70 | 175 | ±2.3% | — | — | ✅ |
| coachInputs | 10,000 | 27.62 | 33.73 | 36 | ±3.6% | — | — | ✅ |
| end-to-end | 500 | 3.90 | 12.62 | 281 | ±10.3% | — | — | ✅ |
| end-to-end | 2,000 | 36.57 | 46.18 | 28 | ±6.2% | — | — | ✅ |
| end-to-end | 10,000 | 960 | 1004 | 1 | ±2.6% | — | — | ✅ |
| planReschedule | 500 | 0.612 | 1.59 | 1,808 | ±3.9% | — | — | ✅ |
| planReschedule | 2,000 | 3.27 | 4.12 | 307 | ±1.2% | — | — | ✅ |
| planReschedule | 10,000 | 62.34 | 65.93 | 16 | ±2.2% | — | — | ✅ |
| shiftBacklog | 500 | 0.111 | 0.314 | 9,568 | ±1.6% | — | — | ✅ |
| shiftBacklog | 2,000 | 1.55 | 3.23 | 673 | ±3.3% | — | — | ✅ |
| shiftBacklog | 10,000 | 35.24 | 36.09 | 28 | ±0.6% | — | — | ✅ |

## schedule

| Benchmark | Size | Mean (ms) | p99 (ms) | ops/s | ±RME | Baseline (ms) | Δ | Status |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| buildCalendar | 500 | 0.865 | 1.27 | 1,166 | ±1.2% | 0.915 | -5.5% | ✅ |
| buildCalendar | 2,000 | 1.35 | 1.87 | 749 | ±1.3% | 1.32 | +1.9% | ✅ |
| buildCalendar | 10,000 | 3.94 | 5.55 | 256 | ±2.2% | 3.90 | +1.1% | ✅ |
| buildSignals | 500 | 1.59 | 2.21 | 637 | ±1.8% | 1.59 | +0.3% | ✅ |
| buildSignals | 2,000 | 5.18 | 5.78 | 193 | ±1.3% | 6.11 | -15.1% | 🟢 faster |
| buildSignals | 10,000 | 24.78 | 27.23 | 40 | ±0.6% | 25.83 | -4.1% | 🔴 over budget |
| currentPlanDay | 500 | 0.224 | 0.394 | 4,516 | ±0.7% | 0.239 | -6.2% | ✅ |
| currentPlanDay | 2,000 | 0.229 | 0.436 | 4,430 | ±0.9% | 0.259 | -11.4% | 🟢 faster |
| currentPlanDay | 10,000 | 0.365 | 2.65 | 4,022 | ±18.9% | 0.236 | +55.0% | 🟠 regression |
| makeSprintForDay | 500 | 0.004 | 0.010 | 242,141 | ±0.7% | 0.004 | +3.4% | ✅ |
| makeSprintForDay | 2,000 | 0.019 | 0.035 | 55,301 | ±0.7% | 0.019 | -4.2% | ✅ |
| makeSprintForDay | 10,000 | 0.096 | 0.225 | 10,809 | ±1.5% | 0.100 | -4.1% | ✅ |
| workingDay | 500 | 0.012 | 0.035 | 93,324 | ±1.3% | 0.012 | +2.3% | ✅ |
| workingDay | 2,000 | 0.035 | 0.073 | 29,188 | ±0.8% | 0.038 | -7.1% | ✅ |
| workingDay | 10,000 | 0.176 | 0.463 | 5,935 | ±1.7% | 0.182 | -3.2% | ✅ |

## stats

| Benchmark | Size | Mean (ms) | p99 (ms) | ops/s | ±RME | Baseline (ms) | Δ | Status |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| breakdown-topics | 500 | 0.012 | 0.019 | 86,937 | ±0.5% | 0.013 | -6.0% | ✅ |
| breakdown-topics | 2,000 | 0.045 | 0.090 | 22,806 | ±0.6% | 0.050 | -9.6% | ✅ |
| breakdown-topics | 10,000 | 0.327 | 0.878 | 3,275 | ±2.8% | 0.337 | -3.0% | ✅ |
| difficultyPerformance | 500 | 0.712 | 1.05 | 1,415 | ±1.0% | 0.769 | -7.4% | ✅ |
| difficultyPerformance | 2,000 | 3.07 | 4.03 | 330 | ±2.5% | 2.84 | +8.0% | ✅ |
| difficultyPerformance | 10,000 | 14.92 | 21.30 | 68 | ±2.5% | 15.27 | -2.3% | ✅ |
| heatmap | 500 | 0.228 | 0.555 | 4,590 | ±1.8% | 0.218 | +4.4% | ✅ |
| heatmap | 2,000 | 0.847 | 1.17 | 1,191 | ±1.0% | 0.845 | +0.2% | ✅ |
| heatmap | 10,000 | 4.09 | 4.55 | 245 | ±1.3% | 4.29 | -4.7% | ✅ |
| streaks | 500 | 0.445 | 0.963 | 2,329 | ±2.1% | 0.464 | -4.2% | ✅ |
| streaks | 2,000 | 1.41 | 3.77 | 774 | ±5.2% | 1.19 | +18.4% | 🟠 regression |
| streaks | 10,000 | 4.50 | 5.13 | 223 | ±1.3% | 4.80 | -6.2% | ✅ |
| summary | 500 | 0.011 | 0.046 | 207,510 | ±27.0% | 0.005 | +143.8% | 🟠 regression |
| summary | 2,000 | 0.019 | 0.066 | 56,927 | ±1.1% | 0.020 | -3.8% | ✅ |
| summary | 10,000 | 0.077 | 0.183 | 13,372 | ±0.9% | 0.080 | -3.6% | ✅ |

## Sprint generation

_Production `generateSprintPlan` with AI off (built-in planner), 20 prompts × 2 catalogue sizes, 10 timed runs each. Validation checks catalogue-only problems, no duplicates, per-day time budget, day count, ordering, fill vs target, weak topics first and start date. Details below are for the 2,000-problem catalogue._

Source: `bench/results/metrics/generate.json` · gated in `bench:check`

| Metric | Value | Target | Baseline | Status |
| --- | ---: | ---: | ---: | --- |
| Response time p50 (2,000-problem catalogue) | 1 ms | — | — | ℹ️ |
| Response time p95 (2,000-problem catalogue) | 2 ms | ≤ 500 ms | — | ✅ |
| Response time p50 (10,000-problem catalogue) | 5.6 ms | — | — | ℹ️ |
| Response time p95 (10,000-problem catalogue) | 11.8 ms | ≤ 500 ms | — | ✅ |
| Plans passing validation | 100% | ≥ 95% | — | ✅ |
| Fallback activation _(100% expected: AI is off for benchmarks.)_ | 100% | — | — | ℹ️ |

<details><summary>Details</summary>

| Prompt | Problems | Days | Validation | p50 (ms) |
| --- | --- | --- | --- | --- |
| Google SDE-2 in 6 weeks, 2 hours a day, weak at DP and graphs | 84 | 42 | ✅ | 2 |
| Amazon interview in 4 weeks, 1.5 hrs/day, skip weekends | 39 | 20 | ✅ | 0.9 |
| 3 weeks, 1 hour a day, focus on arrays and strings | 21 | 21 | ✅ | 0.8 |
| Prepare for Microsoft onsite in 2 months, 3 hours daily, struggling with trees | 252 | 63 | ✅ | 2 |
| beginner, 30 minutes a day for 8 weeks, basics only | 56 | 56 | ✅ | 0.7 |
| Meta in 10 days, full-time 6 hours a day, weak at recursion and backtracking | 126 | 14 | ✅ | 1.2 |
| Flipkart SDE-1, 5 weeks, 2 hrs per day, weekdays only | 75 | 25 | ✅ | 0.9 |
| Senior role at Uber in 6 weeks, 2h/day, hard problems, weak in heaps | 84 | 42 | ✅ | 1.2 |
| 4 weeks, 90 minutes a day, sliding window and two pointers, no weekends | 38 | 20 | ✅ | 0.9 |
| Adobe in 3 weeks, 2 hours a day, start 2026-10-19, 2026-10-23 off | 52 | 20 | ✅ | 0.8 |
| 1 week crash course for Zoho, 4 hours a day | 42 | 7 | ✅ | 0.8 |
| I have about 12 hours a week for 6 weeks and want to get better at dynamic programming | 81 | 42 | ✅ | 1 |
| Atlassian interview next month, weak at graphs, 2 hours a day, skip weekends | 58 | 20 | ✅ | 1.1 |
| Brush up linked lists, stacks and queues in 2 weeks, an hour a day | 41 | 14 | ✅ | 0.9 |
| 8 weeks to cover everything for Google, 1.5 hours a day, starting next monday | 110 | 56 | ✅ | 1 |
| Amazon OA in 5 days, 3 hours a day | 28 | 7 | ✅ | 0.7 |
| Binary search and bit manipulation, 3 weeks, 45 mins daily | 21 | 21 | ✅ | 0.8 |
| staff engineer loop at Microsoft in 4 weeks, 2 hours a day, weak at trie and greedy | 56 | 28 | ✅ | 1.2 |
| 12 weeks, 1 hour a day, every day including weekends, mixed topics | 84 | 84 | ✅ | 0.8 |
| Need help with hashing and sorting before placements, 3 weeks, 2 hours daily | 62 | 21 | ✅ | 0.8 |

</details>

## AI note review

_Production `reviewNote` with AI off (built-in analyzer) on 16 labelled notes, 30 timed runs each. Agreement = exact match after normalising complexity notation; edge-case recall = expected findings matched by severity + keyword. 16 of 16 labels are drafts awaiting a second reviewer._

Source: `bench/results/metrics/review.json` · gated in `bench:check`

| Metric | Value | Target | Baseline | Status |
| --- | ---: | ---: | ---: | --- |
| Response time p50 | 0.013 ms | — | — | ℹ️ |
| Response time p95 | 0.021 ms | ≤ 50 ms | — | ✅ |
| Time-complexity agreement | 87.5% | ≥ 70% | — | ✅ |
| Space-complexity agreement | 75% | ≥ 60% | — | ✅ |
| Edge-case recall | 85.7% | ≥ 70% | — | ✅ |
| False alarms on clean code | 0% | ≤ 20% | — | ✅ |
| Optimal/suboptimal verdict agreement _(The built-in analyzer never judges optimality (always "unknown"); only the AI reviewer can.)_ | 0% | — | — | ℹ️ |
| Fallback activation _(100% expected: AI is off for benchmarks.)_ | 100% | — | — | ℹ️ |

<details><summary>Details</summary>

| Item | Time | Space | Edge cases found | Label |
| --- | --- | --- | --- | --- |
| two-sum-hash | O(n) ✅ | O(n) ✅ | — | draft |
| two-sum-brute | O(n^2) ✅ | O(n) ❌ (want O(1)) | — | draft |
| binary-search-overflow | O(log n) ✅ | O(1) ✅ | 1/1 | draft |
| binary-search-safe-python | O(log n) ✅ | O(1) ✅ | — | draft |
| max-subarray-off-by-one | O(n) ✅ | O(1) ✅ | 2/2 | draft |
| adjacent-diff-out-of-bounds | O(n) ✅ | O(n) ❌ (want O(1)) | 1/1 | draft |
| product-int-overflow | O(n log n) ✅ | O(1) ✅ | 0/1 | draft |
| kth-largest-heap | O(n log n) ❌ (want O(n log k)) | O(n) ❌ (want O(k)) | — | draft |
| three-sum-cubic | O(n^3) ✅ | O(n) ✅ | — | draft |
| three-sum-two-pointers | O(n^3) ❌ (want O(n^2)) | O(n) ❌ (want O(1)) | — | draft |
| climbing-stairs-dp | O(n) ✅ | O(n) ✅ | — | draft |
| first-element-no-guard | O(n) ✅ | O(n) ✅ | 1/1 | draft |
| prose-only | O(n) ✅ | O(n) ✅ | — | draft |
| contains-duplicate-set | O(n) ✅ | O(n) ✅ | — | draft |
| matrix-search-quadratic | O(n^2) ✅ | O(1) ✅ | 1/1 | draft |
| sliding-window-js | O(n) ✅ | O(n) ✅ | — | draft |

</details>

## Reliability

_Offline fault injection (no model calls): a fake LLM fails 10% slow, 10% error, 10% invalid, with a 50 ms timeout. Production `reviewNote` (80 requests) and `generateSprintPlan` (100 requests) run against it. Model-call rates show what was injected; the gated metrics are how the app copes: no request may fail and every fallback must still produce a valid result._

Source: `bench/results/metrics/reliability.json` · gated in `bench:check`

| Metric | Value | Target | Baseline | Status |
| --- | ---: | ---: | ---: | --- |
| Requests that failed (threw) | 0% | ≤ 0% | — | ✅ |
| Note reviews returning a usable result | 100% | ≥ 100% | — | ✅ |
| Generated plans passing validation | 100% | ≥ 95% | — | ✅ |
| Model-call success rate (injected) | 66.8% | — | — | ℹ️ |
| Model-call timeout rate (injected) | 9.7% | — | — | ℹ️ |
| Model-call error rate incl. invalid output (injected) | 23.5% | — | — | ℹ️ |
| Fallback activation: note review | 32.5% | — | — | ℹ️ |
| Fallback activation: sprint generation | 56% | — | — | ℹ️ |
| Note review p95 incl. timeouts | 51.5 ms | ≤ 75 ms | — | ✅ |
| Sprint generation p95 incl. timeouts | 60.2 ms | ≤ 300 ms | — | ✅ |

<details><summary>Details</summary>

| Feature | Model calls | Success | Timeout | Error / invalid |
| --- | --- | --- | --- | --- |
| Note review | 80 | 67.5% | 12.5% | 20% |
| Sprint generation | 167 | 66.5% | 8.4% | 25.1% |

</details>

## Findings

- filters/applyFilters-search@2000: +15.8% slower than baseline
- filters/applyFilters-sortName@500: +40.1% slower than baseline
- filters/applyFilters-sortName@10000: 30.52 ms > 16 ms budget
- import/parseWorkbook@500: +35.3% slower than baseline
- schedule/buildSignals@10000: 24.78 ms > 16 ms budget
- schedule/currentPlanDay@10000: +55.0% slower than baseline
- stats/streaks@2000: +18.4% slower than baseline
- stats/summary@500: +143.8% slower than baseline
