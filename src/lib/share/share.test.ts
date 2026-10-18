import { describe, expect, it, vi } from "vitest";
import type { SkillProfile } from "@/lib/readiness";
import { isSlug, SCOUT_LINE_MAX } from "./schema";
import { scoutReport, scoutUser, templateScout } from "./scout";
import { makeSlug } from "./slug";

const profile: SkillProfile = {
  skills: [
    { key: "Trees", score: 90, total: 10, proLeft: 0 },
    { key: "Sliding Window", score: 80, total: 6, proLeft: 0 },
    { key: "Backtracking", score: 10, total: 5, proLeft: 3 },
    { key: "OS Concurrency", score: 20, total: 4, proLeft: 1 },
  ],
  strengths: ["Trees", "Sliding Window"],
  weaknesses: ["Backtracking", "OS Concurrency"],
};
const empty: SkillProfile = { skills: [], strengths: [], weaknesses: [] };

describe("templateScout", () => {
  it("writes the battle-tested / vulnerable lines", () => {
    expect(templateScout(profile, 50)).toEqual({
      line1: "Battle-tested in Trees & Sliding Window.",
      line2: "Vulnerable in Backtracking and OS Concurrency — that's the next boss fight.",
    });
  });

  it("has copy for empty strengths or weaknesses", () => {
    expect(templateScout(empty, 0).line1).toMatch(/Just getting started/);
    expect(templateScout(empty, 12).line1).toContain("12%");
    expect(templateScout({ ...profile, weaknesses: [] }, 90).line2).toMatch(/No weak spots/);
  });

  it("keeps lines within the limit", () => {
    const long = { ...profile, strengths: ["x".repeat(80), "y".repeat(80)] };
    expect(templateScout(long, 1).line1.length).toBeLessThanOrEqual(SCOUT_LINE_MAX);
  });
});

describe("scoutReport", () => {
  it("uses the model when available, sending aggregates only", async () => {
    const llm = vi.fn().mockResolvedValue({ line1: "Sharp on Trees.", line2: "Shaky on Backtracking." });
    const r = await scoutReport(profile, [{ company: "Google", score: 82, done: 8, total: 10, confidence: "high" }], 60, { llm });
    expect(r).toMatchObject({ line1: "Sharp on Trees.", line2: "Shaky on Backtracking.", ai: true, strengths: profile.strengths });
    const { user } = llm.mock.calls[0][0];
    expect(user).toContain("Google: 82%");
    expect(user).toContain("Backtracking: 10%");
  });

  it("falls back to the template when the model fails", async () => {
    const log = vi.fn();
    const r = await scoutReport(profile, [], 50, { llm: vi.fn().mockRejectedValue(new Error("boom")), log });
    expect(r).toMatchObject({ ai: false, line1: "Battle-tested in Trees & Sliding Window." });
    expect(log).toHaveBeenCalled();
  });

  it("skips the model when there is nothing to judge", async () => {
    const llm = vi.fn();
    expect((await scoutReport(empty, [], 0, { llm })).ai).toBe(false);
    expect(llm).not.toHaveBeenCalled();
  });

  it("says when company data is a small sample", () => {
    expect(scoutUser(profile, [{ company: "Zoho", score: 40, done: 2, total: 5, confidence: "low" }], 10)).toContain("Zoho: 40% (small sample)");
  });
});

describe("makeSlug", () => {
  it("kebab-cases the title and appends 6 random characters", () => {
    const slug = makeSlug("Striver's A2Z — DSA Sheet!", () => 0);
    expect(slug).toBe("striver-s-a2z-dsa-sheet-aaaaaa");
    expect(isSlug(slug)).toBe(true);
  });

  it("is always URL- and DB-safe", () => {
    for (const title of ["", "   ", "日本語", "Ünïcödé Prep", "a".repeat(200), "--x--", "Ω".repeat(50)]) {
      const slug = makeSlug(title);
      expect(isSlug(slug), slug).toBe(true);
      expect(slug.length).toBeLessThanOrEqual(47);
    }
    expect(makeSlug("")).toMatch(/^sprint-[a-z0-9]{6}$/);
  });

  it("is random", () => {
    expect(makeSlug("x")).not.toBe(makeSlug("x"));
  });
});
