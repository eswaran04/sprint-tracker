import { addDays, format, nextMonday, parseISO } from "date-fns";
import type { Goal } from "./schema";

/**
 * Regex-based fallback for goal parsing, used when the LLM is unavailable or fails. Covers the common phrasings
 * ("6 weeks", "2 hrs/day", "weak at DP and graphs", "skip weekends", "Google").
 */
const COMPANIES = ["Google", "Meta", "Facebook", "Amazon", "Apple", "Netflix", "Microsoft", "Uber", "Adobe", "Flipkart", "Atlassian", "Salesforce", "Oracle", "LinkedIn", "Bloomberg", "Goldman Sachs", "Walmart", "Zoho", "Airbnb", "Stripe"];

const TOPIC_WORDS: [RegExp, string][] = [
  [/\b(dp|dynamic programming)\b/i, "Dynamic Programming"],
  [/\bgraphs?\b/i, "Graphs"],
  [/\b(trees?|binary trees?)\b/i, "Trees"],
  [/\b(bst|binary search trees?)\b/i, "Binary Search Tree"],
  [/\bbinary search\b/i, "Binary Search"],
  [/\blinked ?lists?\b/i, "Linked List"],
  [/\barrays?\b/i, "Arrays"],
  [/\bstrings?\b/i, "Strings"],
  [/\b(heaps?|priority queues?)\b/i, "Heap"],
  [/\b(stacks?|queues?)\b/i, "Stack"],
  [/\bgreedy\b/i, "Greedy"],
  [/\b(recursion|backtracking)\b/i, "Recursion"],
  [/\bbit ?manipulation\b/i, "Bit Manipulation"],
  [/\btries?\b/i, "Trie"],
  [/\bsliding window\b/i, "Sliding Window"],
  [/\btwo pointers?\b/i, "Two Pointers"],
  [/\bhashing|hash ?maps?\b/i, "Hashing"],
];

const topicsIn = (s: string) => TOPIC_WORDS.filter(([re]) => re.test(s)).map(([, t]) => t);

export function heuristicGoal(prompt: string, today: string): Goal {
  const p = prompt.replace(/\s+/g, " ");
  const company = COMPANIES.find((c) => new RegExp(`\\b${c}\\b`, "i").test(p)) ?? null;

  let weeks = 4;
  const w = p.match(/(\d+(?:\.\d+)?)\s*(weeks?|wks?|w)\b/i);
  const m = p.match(/(\d+(?:\.\d+)?)\s*(months?|mos?)\b/i);
  const d = p.match(/(\d+)\s*days?\b(?!\s*(?:a|per|\/)\s*week)/i);
  if (w) weeks = Math.round(Number(w[1]));
  else if (m) weeks = Math.round(Number(m[1]) * 4.33);
  else if (d) weeks = Math.ceil(Number(d[1]) / 7);
  weeks = Math.min(52, Math.max(1, weeks));

  let hours = 2;
  const h = p.match(/(\d+(?:\.\d+)?)\s*(hours?|hrs?|h)\b\s*(?:\/|a|per|each)?\s*(day|daily|week|wk)?/i);
  const mins = p.match(/(\d+)\s*(minutes?|mins?)\b/i);
  if (h) hours = /week|wk/i.test(h[3] ?? "") ? Number(h[1]) / 7 : Number(h[1]);
  else if (mins) hours = Number(mins[1]) / 60;
  hours = Math.min(12, Math.max(0.5, Math.round(hours * 4) / 4));

  const weakClause = p.match(/(?:weak(?: at| in| on)?|struggl\w* with|bad at|not good at|need (?:work|help) (?:on|with))\s+([^.;]+?)(?=[,.;]\s*(?:skip|no |start|\d)|[.;]|$)/i);
  const weak = weakClause ? topicsIn(weakClause[1]) : [];
  const focus = topicsIn(p).filter((t) => !weak.includes(t));

  const skip = /\b(skip|no|without|except|avoid)\s+(the\s+)?weekends?\b|\bweekdays? only\b|\bonly weekdays\b/i.test(p);

  // ISO dates next to "off" / "rest" / "skip" / "break" / "holiday" are rest days; others may be the start date.
  const restDays: string[] = [];
  let start: string | null = null;
  for (const mt of p.matchAll(/\b(\d{4}-\d{2}-\d{2})\b/g)) {
    const before = p.slice(Math.max(0, mt.index - 25), mt.index);
    const after = p.slice(mt.index + mt[0].length, mt.index + mt[0].length + 12);
    if (/\b(off|rest|skip|break|holiday|except|not on|free)\b/i.test(before) || /^\s*(off|as a rest|free)\b/i.test(after)) restDays.push(mt[1]);
    else if (!start) start = mt[1];
  }
  if (!start && /\btomorrow\b/i.test(p)) start = format(addDays(parseISO(today), 1), "yyyy-MM-dd");
  else if (!start && /\bnext monday\b/i.test(p)) start = format(nextMonday(parseISO(today)), "yyyy-MM-dd");

  const senior = /\b(sde|swe)[- ]?(2|ii|3|iii)\b|\bsenior\b|\bstaff\b|\bl[5-7]\b|\bhard\b/i.test(p);
  const junior = /\b(beginner|fresher|intern|new grad|sde[- ]?1|l3|easy|basics?)\b/i.test(p);
  const mix = junior ? { basic: 0.4, core: 0.45, pro: 0.15 } : senior ? { basic: 0.15, core: 0.5, pro: 0.35 } : { basic: 0.25, core: 0.5, pro: 0.25 };

  const role = p.match(/\b((?:sde|swe)[- ]?(?:\d|i{1,3})|senior|staff)\b/i)?.[1];
  const title = [company, role?.toUpperCase(), `${weeks} week${weeks === 1 ? "" : "s"}`].filter(Boolean).join(" · ");

  return {
    company,
    weeks,
    hours_per_day: hours,
    weak_topics: weak,
    focus_topics: focus,
    skip_weekends: skip,
    start_date: start,
    rest_days: restDays,
    difficulty_mix: mix,
    title: title || "My prep sprint",
  };
}
