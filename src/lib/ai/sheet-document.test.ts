import { describe, expect, it } from "vitest";
import { mkSheet } from "@/test/fixtures/sheets";
import { contentHash, sheetDocument, toVectorLiteral } from "./sheet-document";

describe("sheetDocument", () => {
  it("includes title, description, topics, top companies with counts, size and difficulty", () => {
    const doc = sheetDocument(mkSheet());
    expect(doc).toBe(
      [
        "Title: DSA Prep Sheet",
        "Description: Arrays to DP in 20 sprints",
        "Topics: Arrays, Hashing, Graphs",
        "Companies: Zoho (150), Google (120), Amazon (110), Meta (90), Adobe (80), Apple (40)",
        "Size: 600 problems over 136 days",
        "Difficulty: 200 basic, 300 core, 100 pro",
      ].join("\n"),
    );
  });

  it("is deterministic regardless of company key order and breaks count ties by name", () => {
    const a = sheetDocument(mkSheet({ company_counts: { Zeta: 5, Alpha: 5, Beta: 9 } }));
    const b = sheetDocument(mkSheet({ company_counts: { Beta: 9, Alpha: 5, Zeta: 5 } }));
    expect(a).toBe(b);
    expect(a).toContain("Companies: Beta (9), Alpha (5), Zeta (5)");
  });

  it("caps topics at 15 and companies at 10, and omits empty sections", () => {
    const topics = Array.from({ length: 20 }, (_, i) => `T${i}`);
    const company_counts = Object.fromEntries(Array.from({ length: 12 }, (_, i) => [`C${i}`, 100 - i]));
    const doc = sheetDocument(mkSheet({ topics, company_counts, description: "  " }));
    expect(doc).toContain(`Topics: ${topics.slice(0, 15).join(", ")}`);
    expect(doc).not.toContain("T15");
    expect(doc).toContain("C9 (91)");
    expect(doc).not.toContain("C10");
    expect(doc).not.toContain("Description:");

    const bare = sheetDocument({ title: "X", description: "", topics: [], company_counts: {} });
    expect(bare).toBe("Title: X");
  });

  it("ignores fields that don't change meaning (copies, owner, publish date)", () => {
    expect(sheetDocument(mkSheet({ copy_count: 999, owner_name: "Other", published_at: null }))).toBe(sheetDocument(mkSheet()));
  });
});

describe("contentHash", () => {
  it("is stable for the same input and changes with document, model or dimensions", () => {
    const doc = sheetDocument(mkSheet());
    const h = contentHash(doc, "gemini-embedding-001", 768);
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(contentHash(doc, "gemini-embedding-001", 768)).toBe(h);
    expect(contentHash(`${doc}!`, "gemini-embedding-001", 768)).not.toBe(h);
    expect(contentHash(doc, "text-embedding-005", 768)).not.toBe(h);
    expect(contentHash(doc, "gemini-embedding-001", 1536)).not.toBe(h);
  });
});

it("formats pgvector literals", () => {
  expect(toVectorLiteral([0.5, -1, 2e-7])).toBe("[0.5,-1,2e-7]");
});
