import { describe, expect, it } from "vitest";
import { mkProblem } from "@/test/fixtures/problems";
import { asMember, headToHead, leaderboard, problemKey, progressIndex, recentSolves } from "./groups";
import type { GroupMember, GroupProgressRow } from "./types";

const at = (y: number, m: number, d: number) => new Date(y, m - 1, d, 12).toISOString();
const member = (user_id: string, display_name: string): GroupMember => ({
  group_id: "g", user_id, sprint_id: `s-${user_id}`, display_name, avatar: null, role: "member", joined_at: at(2026, 9, 1),
});
const members = [member("a", "Prathis"), member("b", "Eswaran"), member("c", "New")];
const rows: GroupProgressRow[] = [
  { user_id: "a", problem_key: "p1", done_at: at(2026, 10, 2) },
  { user_id: "a", problem_key: "p2", done_at: at(2026, 10, 3) },
  { user_id: "a", problem_key: "p3", done_at: at(2026, 10, 4) },
  { user_id: "b", problem_key: "p1", done_at: at(2026, 9, 20) },
  { user_id: "b", problem_key: "p4", done_at: at(2026, 10, 4) },
];

describe("problemKey", () => {
  it("uses the source problem for copies", () => {
    expect(problemKey({ id: "x", source_id: "src" })).toBe("src");
    expect(problemKey({ id: "x", source_id: null })).toBe("x");
  });
});

describe("progressIndex", () => {
  it("maps problem → member → completion date", () => {
    const idx = progressIndex(rows);
    expect([...idx.get("p1")!.keys()]).toEqual(["a", "b"]);
    expect(idx.get("p4")!.get("b")).toBe(at(2026, 10, 4));
    expect(idx.has("p9")).toBe(false);
  });
});

describe("leaderboard", () => {
  it("ranks by problems done with today, streak and last active", () => {
    const board = leaderboard(members, rows, "2026-10-04");
    expect(board.map((r) => r.member.display_name)).toEqual(["Prathis", "Eswaran", "New"]);
    expect(board[0]).toMatchObject({ done: 3, doneToday: 1, streak: 3, lastActive: at(2026, 10, 4) });
    expect(board[1]).toMatchObject({ done: 2, doneToday: 1, streak: 1 });
    expect(board[2]).toMatchObject({ done: 0, doneToday: 0, streak: 0, lastActive: null });
  });
});

describe("asMember", () => {
  it("shows your sheet with the member's completions and none of your private bits", () => {
    const mine = [
      mkProblem({ id: "p1", done_at: at(2026, 10, 1), starred: true, notes: "secret" }),
      mkProblem({ id: "copy4", source_id: "p4" }),
      mkProblem({ id: "p5" }),
    ];
    const theirs = asMember(mine, progressIndex(rows), "b");
    expect(theirs.map((p) => p.done_at)).toEqual([at(2026, 9, 20), at(2026, 10, 4), null]);
    expect(theirs.every((p) => !p.starred && p.notes === "")).toBe(true);
    expect(mine[0].notes).toBe("secret");
  });
});

describe("headToHead", () => {
  it("splits problems into solved by both, only you and only them (newest first)", () => {
    const mine = [mkProblem({ id: "p1", done_at: at(2026, 10, 1) }), mkProblem({ id: "p2", done_at: at(2026, 10, 1) }), mkProblem({ id: "p3" }), mkProblem({ id: "p4" })];
    const theirs = [mkProblem({ id: "p1", done_at: at(2026, 10, 2) }), mkProblem({ id: "p2" }), mkProblem({ id: "p3", done_at: at(2026, 10, 1) }), mkProblem({ id: "p4", done_at: at(2026, 10, 3) })];
    const h = headToHead(mine, theirs);
    expect(h.both).toBe(1);
    expect(h.meOnly).toBe(1);
    expect(h.theyOnly.map((p) => p.id)).toEqual(["p4", "p3"]);
  });
});

describe("recentSolves", () => {
  it("lists done problems newest first, up to the limit", () => {
    const ps = [mkProblem({ id: "a", done_at: at(2026, 10, 1) }), mkProblem({ id: "b" }), mkProblem({ id: "c", done_at: at(2026, 10, 3) }), mkProblem({ id: "d", done_at: at(2026, 10, 2) })];
    expect(recentSolves(ps).map((p) => p.id)).toEqual(["c", "d", "a"]);
    expect(recentSolves(ps, 2).map((p) => p.id)).toEqual(["c", "d"]);
  });
});
