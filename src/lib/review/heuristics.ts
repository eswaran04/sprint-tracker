import { extractBlocks, normComplexity, proseOf, statedComplexity, stripReview, type CodeBlock } from "./blocks";
import type { EdgeCase, Review, ReviewProblem } from "./schema";

/**
 * Built-in analyzer used when no LLM is configured or the call fails. It is deliberately conservative:
 * a rough complexity estimate from loop nesting, a handful of well-known bug patterns, and keyword-based tags.
 * It never claims to know the optimal complexity.
 */

const LOOP_RE = /\b(for|while)\b\s*\(|\bfor\b\s+[\w,\s()]+\s+in\b|\bwhile\b\s+[^:\n]+:|\.forEach\(|\.map\(/;
const SORT_RE = /\b(sort|sorted)\s*\(|Arrays\.sort|Collections\.sort|\.sort\(/;
const HEAP_RE = /PriorityQueue|heapq|priority_queue|MinHeap|MaxHeap/;
const HALVING_RE = /(>>>?=?\s*1\b|\/=?\s*2\b|\bmid\b)/;

/** Indentation-based nesting estimate: a loop deeper-indented than another open loop counts as nested. */
function loopDepth(lines: string[]) {
  let max = 0;
  const stack: number[] = [];
  for (const raw of lines) {
    if (!raw.trim()) continue;
    const indent = raw.length - raw.trimStart().length;
    while (stack.length && indent <= stack[stack.length - 1]) stack.pop();
    if (LOOP_RE.test(raw)) {
      stack.push(indent);
      max = Math.max(max, stack.length);
    }
  }
  return max;
}

const ALLOC_RE =
  /\bnew\s+(int|long|boolean|char|double|String)\s*\[|\bnew\s+(HashMap|HashSet|ArrayList|LinkedList|ArrayDeque|TreeMap|TreeSet|PriorityQueue|Stack)\b|\bdict\(|\bset\(|\[\s*0\s*\]\s*\*|\bvector<|unordered_(map|set)|new (Map|Set|Array)\(|defaultdict|Counter\(|=\s*\[\s*\]|=\s*\{\s*\}/;

function guessComplexity(blocks: CodeBlock[]) {
  if (!blocks.length) return null;
  const all = blocks.flatMap((b) => b.lines);
  const code = all.join("\n");
  const depth = loopDepth(all);
  const binary = /\b(lo|low|left|l)\b\s*<=?\s*\b(hi|high|right|r)\b/.test(code) && HALVING_RE.test(code);

  let time: string;
  if (depth >= 3) time = "O(n^3)";
  else if (depth === 2) time = "O(n^2)";
  else if (depth === 1 && binary && !/\bfor\b/.test(code)) time = "O(log n)";
  else if (SORT_RE.test(code) || HEAP_RE.test(code) || (depth === 1 && binary)) time = "O(n log n)";
  else if (depth === 1) time = "O(n)";
  else time = "O(1)";

  return { time, space: ALLOC_RE.test(code) ? "O(n)" : "O(1)" };
}

const MID_SUM_RE = /\(\s*(\w+)\s*\+\s*(\w+)\s*\)\s*(\/\s*2|>>\s*1)/;
/** Languages with fixed-width ints (Python/JS don't overflow the same way). */
const FIXED_WIDTH = new Set(["java", "c", "cpp", "c++", "cs", "csharp", "go", "kotlin", "swift", "rust", ""]);

function scanEdgeCases(blocks: CodeBlock[]): EdgeCase[] {
  const out: EdgeCase[] = [];
  const push = (e: EdgeCase) => {
    if (out.length < 8 && !out.some((o) => o.block === e.block && o.line === e.line && o.message === e.message)) out.push(e);
  };
  for (const b of blocks) {
    const typed = FIXED_WIDTH.has(b.lang) && !b.lines.some((l) => /^\s*def\s|^\s*(const|let)\s/.test(l));
    const code = b.lines.join("\n");
    b.lines.forEach((l, i) => {
      const line = i + 1;
      const mid = MID_SUM_RE.exec(l);
      if (mid && typed && !/\blong\b|\bi64\b|\bint64\b/.test(l)) {
        push({
          block: b.index, line, severity: "risk",
          message: `Integer overflow: \`${mid[1]} + ${mid[2]}\` can exceed 2^31 - 1 when both are large. Use \`${mid[1]} + (${mid[2]} - ${mid[1]}) / 2\` (or \`(${mid[1]} + ${mid[2]}) >>> 1\` in Java).`,
        });
      }
      const next = /(\w+)\[\s*(\w+)\s*\+\s*1\s*\]/.exec(l);
      if (next) {
        const v = next[2];
        const guarded = new RegExp(`${v}\\s*\\+\\s*1\\s*<|${v}\\s*<\\s*[\\w.()]+\\s*-\\s*1|${v}\\s*<=\\s*[\\w.()]+\\s*-\\s*2|range\\([^)]*-\\s*1\\)`).test(code);
        if (!guarded) push({ block: b.index, line, severity: "risk", message: `\`${next[0]}\` reads one past \`${v}\`; make sure the loop stops at length - 1.` });
      }
      if (/\bfor\b.*<=\s*\w+(\.length|\.size\(\)|\.len\(\))(?!\s*-)/.test(l)) {
        push({ block: b.index, line, severity: "bug", message: "Off-by-one: the loop runs while `<= length`, which indexes past the last element." });
      }
      if (typed && /\bint\s+\w+\s*=\s*[^;]*\w\s*\*\s*\w[^;]*;/.test(l) && !/\(long\)/.test(l)) {
        push({ block: b.index, line, severity: "note", message: "Multiplying `int`s can overflow; cast to `long` before multiplying if values can be large." });
      }
    });
    const first = /(\w+)\[\s*0\s*\]/.exec(code);
    const emptyGuard = /\.length\s*(==|<|<=)\s*[012]|isEmpty\(\)|len\(\w+\)\s*(==|<|<=)\s*[012]|if\s+not\s+\w+|\.size\(\)\s*(==|<|<=)\s*[012]|\.empty\(\)/;
    if (first && !emptyGuard.test(code)) {
      push({ block: b.index, line: b.lines.findIndex((l) => l.includes(first[0])) + 1, severity: "risk", message: `\`${first[0]}\` is read without checking for empty input.` });
    }
  }
  return out;
}

const TAG_RULES: [string, RegExp][] = [
  ["Two Pointers", /two pointers?|\b(left|lo)\b\s*<\s*\b(right|hi)\b/i],
  ["Sliding Window", /sliding window|\bwindow\b/i],
  ["Binary Search", /binary search|\bmid\b\s*=|bisect/i],
  ["Hash Map", /HashMap|unordered_map|\bdict\(|\bMap<|new Map\(|defaultdict|Counter\(|hash ?map/i],
  ["Hash Set", /HashSet|unordered_set|\bset\(\)|new Set\(|hash ?set/i],
  ["Prefix Sum", /prefix ?sum|\bprefix\[|\bpre\[|\bpsum\b|running sum/i],
  ["Dynamic Programming", /\bdp\b|\bmemo\b|@cache|lru_cache|dynamic programming|tabulation/i],
  ["Heap", /PriorityQueue|heapq|priority_queue|\bheap\b/i],
  ["Monotonic Stack", /monotonic/i],
  ["Stack", /\bStack<|\bstack\b\s*=|new Stack\b/],
  ["BFS", /\bbfs\b|\bQueue<|deque\(|\.popleft\(|breadth/i],
  ["DFS", /\bdfs\b|depth.first/i],
  ["Backtracking", /backtrack/i],
  ["Recursion", /recurs/i],
  ["Greedy", /greedy/i],
  ["Sorting", /\b(sort|sorted)\s*\(|Arrays\.sort|Collections\.sort/],
  ["Bit Manipulation", /\^=|>>>|&\s*1\b|\bxor\b|bitmask/i],
  ["Union Find", /union.?find|disjoint set|\bparent\[/i],
  ["Trie", /\btrie\b|TrieNode/i],
  ["Linked List", /ListNode/],
  ["Fast & Slow Pointers", /\bslow\b[\s\S]*\bfast\b|floyd|tortoise/i],
  ["Topological Sort", /topolog|indegree|in_degree|kahn/i],
];

const norm = (t: string) => t.toLowerCase().replace(/[^a-z0-9]/g, "").replace(/s$/, "");

/** Drops tags already covered by the problem's topics (loose match: "Hashing" covers "Hash Map") and duplicates. */
export function newTags(tags: string[], topics: string[]) {
  const have = topics.map(norm).filter(Boolean);
  const seen = new Set<string>();
  return tags
    .map((t) => t.trim())
    .filter((t) => {
      const n = norm(t);
      if (!n || seen.has(n)) return false;
      seen.add(n);
      return !have.some((h) => h === n || h.includes(n) || n.includes(h) || (h.startsWith("hash") && n.startsWith("hash")));
    });
}

function suggestTags(notes: string, topics: string[]) {
  const tags = TAG_RULES.filter(([, re]) => re.test(notes)).map(([t]) => t);
  const filtered = tags.includes("Monotonic Stack") ? tags.filter((t) => t !== "Stack") : tags;
  return newTags(filtered, topics).slice(0, 5);
}

export function heuristicReview(problem: ReviewProblem, notes: string): Review {
  const clean = stripReview(notes);
  const blocks = extractBlocks(clean);
  const stated = statedComplexity(clean);
  const guess = guessComplexity(blocks);
  const edge_cases = scanEdgeCases(blocks);

  const time = guess?.time ?? stated.time ?? "Unknown";
  const space = guess?.space ?? stated.space ?? "Unknown";
  const mismatch = guess && stated.time && normComplexity(stated.time) !== normComplexity(guess.time);

  const explanation = !blocks.length
    ? proseOf(clean)
      ? "No code found, so this uses the complexity you stated. Add a code block for a line-level review."
      : "Nothing to analyse yet."
    : `Estimated from loop nesting and library calls${mismatch ? `; you stated ${stated.time}, so double-check which is right` : ""}. The optimal bound for this problem needs the AI reviewer.`;

  const bugs = edge_cases.filter((e) => e.severity === "bug").length;
  const summary = !blocks.length
    ? "Quick check of your approach. Add code for edge-case spotting."
    : edge_cases.length
      ? `Found ${edge_cases.length} potential issue${edge_cases.length > 1 ? "s" : ""}${bugs ? ` (${bugs} likely bug${bugs > 1 ? "s" : ""})` : ""}.`
      : "No common pitfalls detected by the built-in checks.";

  return {
    summary,
    complexity: { time, space, optimal_time: "Unknown", optimal_space: "Unknown", verdict: "unknown", explanation },
    edge_cases,
    suggested_tags: suggestTags(clean, problem.topics),
  };
}
