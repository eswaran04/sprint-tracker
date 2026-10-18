import type { PoolClient } from "pg";
import type { Difficulty } from "@/lib/types";
import type { DifficultyMix } from "./schema";

/** One de-duplicated problem from `public_sheet_problems`. */
export interface CatalogueProblem {
  name: string;
  url: string;
  subject: string;
  difficulty: Difficulty | null;
  companies: string[];
  topics: string[];
  /** How many public sheets include this problem (popularity signal). */
  sheets: number;
  /** Earliest position seen; keeps a stable, curated-ish order for ties. */
  order: number;
}

export interface CatalogueRow {
  sprint_id: string;
  position: number;
  name: string;
  url: string;
  subject: string;
  difficulty: Difficulty | null;
  companies: string[] | null;
  topics: string[] | null;
}

export async function loadCatalogueRows(db: PoolClient): Promise<CatalogueRow[]> {
  const { rows } = await db.query<CatalogueRow>(
    `select sprint_id, position, name, url, subject, difficulty, companies, topics
       from public.public_sheet_problems
      order by sprint_id, position
      limit 50000`,
  );
  return rows;
}

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

/** Normalised identity of a problem: URL without scheme/www/query/trailing slash, else its name. */
export function problemKey(name: string, url: string) {
  const u = url.trim().toLowerCase();
  if (u) {
    const cleaned = u
      .replace(/^https?:\/\//, "")
      .replace(/^www\./, "")
      .replace(/[?#].*$/, "")
      .replace(/\/+$/, "");
    if (cleaned) return `u:${cleaned}`;
  }
  return `n:${norm(name).replace(/[^a-z0-9 ]/g, "")}`;
}

function mergeTags(into: string[], add: string[] | null) {
  for (const t of add ?? []) {
    const v = t.trim();
    if (v && !into.some((x) => norm(x) === norm(v))) into.push(v);
  }
}

/** Merges duplicates (same problem in several public sheets) and unions their tags. */
export function dedupe(rows: CatalogueRow[]): CatalogueProblem[] {
  const byKey = new Map<string, CatalogueProblem>();
  const seenIn = new Map<string, Set<string>>();
  for (const r of rows) {
    if (!r.name?.trim()) continue;
    const key = problemKey(r.name, r.url ?? "");
    let p = byKey.get(key);
    if (!p) {
      p = {
        name: r.name.trim(),
        url: (r.url ?? "").trim(),
        subject: r.subject ?? "",
        difficulty: r.difficulty ?? null,
        companies: [],
        topics: [],
        sheets: 0,
        order: r.position,
      };
      byKey.set(key, p);
      seenIn.set(key, new Set());
    } else {
      if (!p.url && r.url) p.url = r.url.trim();
      if (!p.difficulty && r.difficulty) p.difficulty = r.difficulty;
      if (!p.subject && r.subject) p.subject = r.subject;
      p.order = Math.min(p.order, r.position);
    }
    mergeTags(p.companies, r.companies);
    mergeTags(p.topics, r.topics);
    seenIn.get(key)!.add(r.sprint_id);
  }
  for (const [key, p] of byKey) p.sheets = seenIn.get(key)!.size;
  return [...byKey.values()];
}

/** Common shorthand → canonical words. Matching is done against the real vocabulary afterwards. */
const ALIASES: Record<string, string[]> = {
  dp: ["dynamic programming"],
  "dynamic programming": ["dp"],
  graph: ["graphs"],
  graphs: ["graph"],
  tree: ["trees", "binary tree"],
  trees: ["tree", "binary tree"],
  bst: ["binary search tree"],
  ll: ["linked list"],
  "linked lists": ["linked list"],
  array: ["arrays"],
  arrays: ["array"],
  string: ["strings"],
  strings: ["string"],
  heap: ["heaps", "priority queue"],
  heaps: ["heap", "priority queue"],
  "two pointer": ["two pointers"],
  "two pointers": ["two pointer"],
  "sliding window": ["sliding window"],
  bfs: ["breadth-first search", "graphs"],
  dfs: ["depth-first search", "graphs"],
  greedy: ["greedy algorithms"],
  recursion: ["backtracking"],
  backtracking: ["recursion"],
  "bit manipulation": ["bits"],
  stack: ["stacks"],
  stacks: ["stack"],
  queue: ["queues"],
  queues: ["queue"],
  trie: ["tries"],
  tries: ["trie"],
  "binary search": ["binary search"],
  sorting: ["sort"],
  hashing: ["hash table", "hash map"],
  "hash map": ["hashing", "hash table"],
  math: ["maths", "mathematics"],
  fb: ["meta", "facebook"],
  facebook: ["meta"],
  meta: ["facebook"],
  msft: ["microsoft"],
  aws: ["amazon"],
  alphabet: ["google"],
};

/**
 * Maps free-text terms (from the LLM or user) onto tags that actually exist in the catalogue, case-insensitively,
 * with aliases and simple plural/substring tolerance. Unknown terms are reported, never used as filters.
 */
export function matchVocabulary(terms: string[], vocabulary: Iterable<string>) {
  const vocab = [...new Set(vocabulary)];
  const byNorm = new Map(vocab.map((v) => [norm(v), v]));
  const matched = new Set<string>();
  const unknown: string[] = [];
  for (const raw of terms) {
    const t = norm(raw);
    if (!t) continue;
    const candidates = [t, ...(ALIASES[t] ?? [])];
    const hits = new Set<string>();
    for (const c of candidates) {
      const exact = byNorm.get(c) ?? byNorm.get(c.replace(/s$/, "")) ?? byNorm.get(`${c}s`);
      if (exact) hits.add(exact);
    }
    if (!hits.size && t.length >= 3) {
      // e.g. "graph" → "Graph Theory", "dynamic programming" → "Dynamic Programming (1D)".
      for (const c of candidates) for (const [n, v] of byNorm) if (c.length >= 3 && (n.includes(c) || (n.length >= 4 && c.includes(n)))) hits.add(v);
    }
    if (hits.size) hits.forEach((h) => matched.add(h));
    else unknown.push(raw);
  }
  return { matched: [...matched], unknown };
}

export interface RankInput {
  companies: string[];
  weakTopics: string[];
  focusTopics: string[];
  mix: DifficultyMix;
}

export interface RankedProblem extends CatalogueProblem {
  score: number;
  companyMatch: boolean;
  weakMatch: boolean;
  focusMatch: boolean;
}

const hasAny = (tags: string[], wanted: Set<string>) => wanted.size > 0 && tags.some((t) => wanted.has(norm(t)));

export function rank(problems: CatalogueProblem[], input: RankInput): RankedProblem[] {
  const companies = new Set(input.companies.map(norm));
  const weak = new Set(input.weakTopics.map(norm));
  const focus = new Set(input.focusTopics.map(norm));
  const mixWeight: Record<Difficulty, number> = { Basic: input.mix.basic, Core: input.mix.core, Pro: input.mix.pro };
  return problems
    .map((p) => {
      const companyMatch = hasAny(p.companies, companies);
      const weakMatch = hasAny(p.topics, weak);
      const focusMatch = hasAny(p.topics, focus);
      const score =
        (companyMatch ? 10 : 0) +
        (weakMatch ? 6 : 0) +
        (focusMatch ? 4 : 0) +
        (p.difficulty ? mixWeight[p.difficulty] * 3 : 0.5) +
        Math.min(p.sheets, 5) * 0.5 +
        (p.url ? 0.5 : 0) +
        Math.min(p.companies.length, 10) * 0.1;
      return { ...p, score, companyMatch, weakMatch, focusMatch };
    })
    .sort((a, b) => b.score - a.score || a.order - b.order || a.name.localeCompare(b.name));
}

/**
 * Picks the candidate pool sent to the LLM: the top `limit` by score, but always at least `minPerWeak` problems
 * per weak topic (when that many exist), so a strong company signal can't crowd weak topics out.
 */
export function shortlist(ranked: RankedProblem[], opts: { limit: number; weakTopics: string[]; minPerWeak: number }) {
  const picked = new Set<RankedProblem>();
  for (const topic of opts.weakTopics) {
    const t = norm(topic);
    let n = 0;
    for (const p of ranked) {
      if (n >= opts.minPerWeak) break;
      if (p.topics.some((x) => norm(x) === t)) {
        picked.add(p);
        n++;
      }
    }
  }
  for (const p of ranked) {
    if (picked.size >= opts.limit) break;
    picked.add(p);
  }
  // Keep rank order.
  return ranked.filter((p) => picked.has(p));
}

/** Assigns short IDs (`p1`, `p2`, …) and renders the compact lines the LLM sees. */
export function toCandidates(problems: RankedProblem[]) {
  const byId = new Map<string, RankedProblem>();
  const lines: string[] = [];
  problems.forEach((p, i) => {
    const id = `p${i + 1}`;
    byId.set(id, p);
    const clean = (xs: string[], max: number) => xs.slice(0, max).map((x) => x.replace(/[|,\n]/g, " ").trim()).join(",");
    lines.push(`${id}|${p.difficulty ?? "?"}|${clean(p.topics, 4)}|${clean(p.companies, 5)}`);
  });
  return { byId, lines };
}

/** All distinct company/topic tags in the catalogue. */
export function vocabularies(problems: CatalogueProblem[]) {
  const companies = new Set<string>();
  const topics = new Set<string>();
  for (const p of problems) {
    p.companies.forEach((c) => companies.add(c));
    p.topics.forEach((t) => topics.add(t));
  }
  return { companies, topics };
}
