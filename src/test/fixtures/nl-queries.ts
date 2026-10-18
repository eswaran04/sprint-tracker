import type { AiFilters, FacetNames } from "@/lib/ai/nl-filters";

/** Facets of a typical DSA sheet, used by the golden set and unit tests. */
export const SHEET_FACETS: FacetNames = {
  companies: ["Amazon", "Google", "Microsoft", "Meta", "Adobe", "Zoho", "Flipkart", "Uber"],
  topics: ["Arrays", "Sliding Window", "Two Pointers", "Dynamic Programming", "Graphs", "Trees", "Binary Search", "Hashing", "Linked List", "Stack"],
  subjects: ["DSA", "SQL"],
  difficulties: ["Basic", "Core", "Pro", "None"],
};

export interface GoldenQuery {
  text: string;
  /** Fields that must match exactly; unspecified facet fields must be empty, `q` must be empty unless given. */
  expected: Partial<AiFilters>;
}

/** Query → expected filters. Run against the live model with `npm run test:ai` (not part of CI). */
export const NL_QUERIES: GoldenQuery[] = [
  { text: "Amazon sliding window I starred but haven't redone", expected: { companies: ["Amazon"], topics: ["Sliding Window"], status: "starred" } },
  { text: "hard DP problems I haven't solved", expected: { topics: ["Dynamic Programming"], difficulties: ["Pro"], status: "todo" } },
  { text: "easy google array questions", expected: { companies: ["Google"], topics: ["Arrays"], difficulties: ["Basic"] } },
  { text: "what did I finish most recently", expected: { status: "done", sort: "done", dir: "desc" } },
  { text: "most asked graph problems", expected: { topics: ["Graphs"], sort: "companies", dir: "desc" } },
  { text: "medium binary search from microsoft", expected: { companies: ["Microsoft"], topics: ["Binary Search"], difficulties: ["Core"] } },
  { text: "my revisit list", expected: { status: "starred" } },
  { text: "unsolved tree questions asked by meta or uber", expected: { companies: ["Meta", "Uber"], topics: ["Trees"], status: "todo" } },
  { text: "completed linked list problems", expected: { topics: ["Linked List"], status: "done" } },
  { text: "SQL questions", expected: { subjects: ["SQL"] } },
  { text: "two pointers and hashing from zoho, hardest first", expected: { companies: ["Zoho"], topics: ["Two Pointers", "Hashing"], sort: "difficulty", dir: "desc" } },
  { text: "trapping rain water", expected: { q: "trapping rain water" } },
];
