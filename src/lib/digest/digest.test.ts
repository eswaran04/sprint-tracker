import { describe, expect, it, vi } from "vitest";
import { mkProblem, mkSprint } from "@/test/fixtures/problems";
import type { GroupActivityRow, GroupMember, GroupProgressRow } from "@/lib/types";
import { generateDigest } from "./digest";
import { buildDigestFacts, isQuietWeek, type DigestInput } from "./facts";
import { nudgeSuggestions } from "./nudge-suggestions";
import { digestUser } from "./prompt";
import { DigestCopySchema } from "./schema";
import { templateDigest } from "./template";

const NOW = new Date("2026-10-08T12:00:00Z");
const TODAY = "2026-10-08";
const member = (user_id: string, display_name: string): GroupMember => ({
  group_id: "g1", user_id, sprint_id: `s-${user_id}`, display_name, avatar: null, role: "member", joined_at: "2026-10-01T00:00:00Z",
});
const members = [member("me", "Prathis"), member("e", "Eswaran"), member("k", "Kavin")];
const at = (d: string) => `${d}T10:00:00Z`;
const done = (user_id: string, problem_key: string, day: string): GroupProgressRow => ({ user_id, problem_key, done_at: at(day) });
const act = (user_id: string, day: string): GroupActivityRow => ({ user_id, problem_name: "x", done_at: at(day) });

function input(over: Partial<DigestInput> = {}): DigestInput {
  const problems = [
    mkProblem({ id: "a", name: "Two Sum", sprint_no: 1, day_no: 1, notes: "secret note", starred: true }),
    mkProblem({ id: "b", name: "3 Sum", sprint_no: 1, day_no: 2, url: "https://x.test/3sum" }),
    mkProblem({ id: "c", name: "LRU Cache", sprint_no: 2, day_no: 3, difficulty: "Pro" }),
    mkProblem({ id: "d", name: "Trie", sprint_no: 2, day_no: 9 }),
  ];
  return {
    groupName: "Prep squad",
    me: "me",
    members,
    progress: [
      done("e", "a", "2026-10-02"), done("e", "b", "2026-10-06"), done("e", "c", "2026-10-07"),
      done("me", "a", "2026-10-07"),
      done("k", "a", "2026-09-01"), done("k", "b", "2026-09-02"),
    ],
    activity: [act("e", "2026-10-06"), act("e", "2026-10-07"), act("me", "2026-10-07")],
    problems,
    sprint: mkSprint({ start_date: "2026-10-01" }),
    today: TODAY,
    now: NOW,
    ...over,
  };
}

describe("buildDigestFacts", () => {
  it("computes weekly leaders, cleared sprints, standing and pair-ups", () => {
    const f = buildDigestFacts(input())!;
    expect(f.weekSolves).toBe(3);
    expect(f.weekly.map((w) => [w.name, w.solves])).toEqual([["Eswaran", 2], ["Prathis", 1]]);
    // Eswaran finished sprint 1 on 10-06 (in window); Kavin finished it a month ago (not this week).
    expect(f.cleared).toEqual([{ userId: "e", name: "Eswaran", sprintNo: 1, problems: 2 }]);
    // Plan day 8: problems on days 1-7 that I haven't done are b and c.
    expect(f.behind).toEqual({ overdue: 2, planDay: 8, ahead: { userId: "k", name: "Kavin", by: 1 } });
    expect(f.pairUp.map((p) => [p.partner.name, p.problem.name, p.dueForMe])).toEqual([
      ["Eswaran", "3 Sum", true], // Eswaran solved it more recently than Kavin
      ["Eswaran", "LRU Cache", true],
    ]);
  });

  it("is deterministic and never leaks notes or stars", () => {
    const a = buildDigestFacts(input())!;
    const b = buildDigestFacts(input({ progress: [...input().progress].reverse(), activity: [...input().activity].reverse() }))!;
    expect(b).toEqual(a);
    const text = JSON.stringify(a) + digestUser(a);
    expect(text).not.toMatch(/secret note|starred/);
    expect(digestUser(a)).not.toMatch(/https?:|"me"|userId/);
  });

  it("uses the peer-ahead wording when there's no start date", () => {
    const f = buildDigestFacts(input({ sprint: mkSprint({ start_date: null }) }))!;
    expect(f.behind.overdue).toBeNull();
    expect(f.pairUp.every((p) => !p.dueForMe)).toBe(true);
    expect(templateDigest(f).lines.join(" ")).toContain("Kavin is 1 problem ahead of you");
  });

  it("returns null for non-members or empty sheets, and flags quiet weeks", () => {
    expect(buildDigestFacts(input({ me: "stranger" }))).toBeNull();
    expect(buildDigestFacts(input({ problems: [] }))).toBeNull();
    const quiet = buildDigestFacts(input({ progress: [], activity: [], sprint: mkSprint({ start_date: null }) }))!;
    expect(isQuietWeek(quiet)).toBe(true);
    expect(templateDigest(quiet).headline).toBe("A quiet week in Prep squad");
  });

  it("caps lists at 3", () => {
    const many = Array.from({ length: 6 }, (_, i) => member(`m${i}`, `M${i}`));
    const f = buildDigestFacts(input({
      members: [...members, ...many],
      activity: many.map((m) => act(m.user_id, "2026-10-07")),
      progress: many.flatMap((m) => ["a", "b"].map((k) => done(m.user_id, k, "2026-10-07"))),
    }))!;
    expect(f.weekly).toHaveLength(3);
    expect(f.cleared).toHaveLength(3);
    expect(f.pairUp.length).toBeLessThanOrEqual(3);
  });
});

describe("templateDigest", () => {
  it("fits the schema", () => {
    const copy = templateDigest(buildDigestFacts(input())!);
    expect(DigestCopySchema.parse(copy)).toEqual(copy);
    expect(copy.headline).toBe("Eswaran cleared Sprint 1!");
    expect(copy.lines.length).toBeGreaterThanOrEqual(2);
  });
});

describe("generateDigest", () => {
  const facts = () => buildDigestFacts(input())!;

  it("uses the model's wording but always the facts' pair-ups", async () => {
    const llm = vi.fn().mockResolvedValue({ headline: "Big week!", lines: ["Eswaran was on fire."] });
    const d = await generateDigest(facts(), { llm });
    expect(d).toMatchObject({ headline: "Big week!", lines: ["Eswaran was on fire."], ai: true, weekSolves: 3 });
    expect(d.pairUp).toEqual(facts().pairUp);
    expect(llm.mock.calls[0][0].schema).toBe(DigestCopySchema);
  });

  it("falls back to the template when AI is off or the model fails", async () => {
    expect((await generateDigest(facts(), { llm: null })).ai).toBe(false);
    const log = vi.fn();
    const d = await generateDigest(facts(), { llm: vi.fn().mockRejectedValue(new Error("boom")), log });
    expect(d).toMatchObject({ ai: false, headline: "Eswaran cleared Sprint 1!" });
    expect(log).toHaveBeenCalled();
  });
});

describe("nudgeSuggestions", () => {
  it("returns up to 3 messages of at most 140 characters", () => {
    const s = nudgeSuggestions({ name: "Kavin Kumar", streak: 4, doneToday: 0 }, "A".repeat(200));
    expect(s).toHaveLength(3);
    expect(s.every((m) => m.length <= 140)).toBe(true);
    expect(s[1]).toContain("4-day streak, Kavin");
    expect(nudgeSuggestions({ name: "Kavin" })).toHaveLength(2);
  });
});
