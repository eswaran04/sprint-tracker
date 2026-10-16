import { randomUUID } from "node:crypto";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ops, type OpName } from "@/lib/db/ops";
import { pool } from "@/lib/db/pool";
import { upsertUser, withUser } from "@/lib/db/session";

// Runs the real server operations as the restricted app role, so RLS + SQL functions are exercised end to end.
const run = <T = any>(uid: string, name: OpName, args: object = {}) => // eslint-disable-line @typescript-eslint/no-explicit-any
  withUser(uid, (db) => ops[name].run(db, ops[name].args.parse(args) as never)) as Promise<T>;

const tag = randomUUID().slice(0, 8);
const alice = `alice-${tag}`;
const bob = `bob-${tag}`;
const carol = `carol-${tag}`;
const me = (name: string) => ({ name, avatar: null });
const rows = [0, 1, 2].map((i) => ({
  position: i, name: `P${i}`, url: "", subject: "dsa", difficulty: "Basic" as const,
  companies: ["Zoho"], topics: ["Arrays"], sprint_no: 1, day_no: i + 1,
}));

let sprintId: string;

beforeAll(async () => {
  for (const uid of [alice, bob, carol]) await upsertUser({ uid, email: `${uid}@x.test`, name: uid, picture: null });
  const s = await run(alice, "createSprint", { input: { title: "Sheet", start_date: "2026-10-01", skip_weekends: false }, rows });
  sprintId = s.id;
});

afterAll(async () => {
  await pool().end();
  // The app role can't delete users (by design); clean up with the owner role when available.
  const url = process.env.MIGRATION_DATABASE_URL;
  if (url) {
    const admin = new pg.Client({ connectionString: url });
    await admin.connect();
    await admin.query("delete from app.users where id = any($1)", [[alice, bob, carol]]);
    await admin.end();
  }
});

describe("own data (RLS)", () => {
  it("creates a sprint with problems and counts", async () => {
    const list = await run(alice, "listSprints");
    expect(list.find((s: { id: string }) => s.id === sprintId)).toMatchObject({ user_id: alice, total: 3, done: 0 });
    const { sprint, problems } = await run(alice, "getSprint", { id: sprintId });
    expect(sprint.start_date).toBe("2026-10-01");
    expect(problems.map((p: { name: string }) => p.name)).toEqual(["P0", "P1", "P2"]);
  });

  it("hides and protects other users' sprints", async () => {
    expect((await run(bob, "listSprints")).some((s: { id: string }) => s.id === sprintId)).toBe(false);
    await expect(run(bob, "getSprint", { id: sprintId })).rejects.toThrow("Sprint not found");
    await expect(run(bob, "updateSprint", { id: sprintId, patch: { title: "hacked" } })).rejects.toThrow("Not found");
    await run(bob, "deleteSprint", { id: sprintId });
    expect((await run(alice, "getSprint", { id: sprintId })).sprint.title).toBe("Sheet");
  });

  it("rejects unknown patch columns", () => {
    expect(() => ops.updateSprint.args.parse({ id: sprintId, patch: { user_id: bob } })).toThrow();
  });

  it("updates, reschedules and saves filters", async () => {
    const { problems } = await run(alice, "getSprint", { id: sprintId });
    await run(alice, "updateProblem", { id: problems[0].id, patch: { done_at: new Date().toISOString(), starred: true } });
    await run(alice, "reschedule", { changes: [{ id: problems[2].id, day_no: 9, sprint_no: 2 }] });
    const after = (await run(alice, "getSprint", { id: sprintId })).problems;
    expect(after[0].starred).toBe(true);
    expect(after[2]).toMatchObject({ day_no: 9, sprint_no: 2, original_day_no: 3 });

    const f = await run(alice, "createSavedFilter", { name: "zoho", query: { company: ["Zoho"] } });
    expect(await run(bob, "listSavedFilters")).toEqual([]);
    expect((await run(alice, "listSavedFilters"))[0]).toMatchObject({ id: f.id, user_id: alice });
  });
});

describe("public sheets", () => {
  it("publishes without leaking progress and copies", async () => {
    await run(alice, "updateSprint", { id: sprintId, patch: { visibility: "public", published_at: new Date().toISOString() } });
    const pub = await run(bob, "getPublicSheet", { id: sprintId });
    expect(pub.sheet).toMatchObject({ problem_count: 3, basic_count: 3 });
    expect(pub.problems[0]).not.toHaveProperty("done_at");
    expect(pub.problems[0]).not.toHaveProperty("notes");
    const copy = await run<string>(bob, "copyPublicSheet", { id: sprintId });
    const { sprint, problems } = await run(bob, "getSprint", { id: copy });
    expect(sprint).toMatchObject({ user_id: bob, copied_from: sprintId });
    expect(problems.every((p: { done_at: unknown }) => p.done_at === null)).toBe(true);
  });
});

describe("groups, reactions and nudges", () => {
  let groupId: string;

  it("creates, previews and joins", async () => {
    groupId = await run<string>(alice, "createGroup", { sprintId, name: "Crew", me: me("Alice") });
    const { group } = await run(alice, "getGroup", { id: groupId });
    expect(await run(bob, "getGroup", { id: groupId })).toBeNull();
    expect(await run(bob, "groupPreview", { code: group.invite_code })).toMatchObject({ name: "Crew", member_count: 1 });
    const bobSprint = await run<string>(bob, "joinGroup", { code: group.invite_code, me: me("Bob"), existingSprint: null });
    expect(await run(bob, "joinGroup", { code: group.invite_code, me: me("Bob"), existingSprint: null })).toBe(bobSprint);
    expect((await run(bob, "getGroup", { id: groupId })).members).toHaveLength(2);
    expect((await run(bob, "listMyGroups"))[0]).toMatchObject({ id: groupId, role: "member", member_count: 2 });
    expect((await run(bob, "groupProgress", { groupId })).some((r: { user_id: string }) => r.user_id === alice)).toBe(true);
    expect(await run(carol, "groupProgress", { groupId })).toEqual([]);
  });

  it("toggles claps", async () => {
    const day = new Date().toISOString().slice(0, 10);
    await run(bob, "toggleReaction", { groupId, targetUser: alice, day });
    expect(await run(alice, "groupReactions", { groupId, sinceDay: day })).toEqual([
      { group_id: groupId, target_user: alice, day, reactor: bob },
    ]);
    await run(bob, "toggleReaction", { groupId, targetUser: alice, day });
    expect(await run(alice, "groupReactions", { groupId, sinceDay: day })).toEqual([]);
    await expect(run(alice, "toggleReaction", { groupId, targetUser: alice, day })).rejects.toThrow("clap for yourself");
  });

  it("rate-limits nudges and keeps them private", async () => {
    await run(bob, "sendNudge", { groupId, targetUser: alice });
    await expect(run(bob, "sendNudge", { groupId, targetUser: alice })).rejects.toThrow("already nudged");
    expect(await run(alice, "myNudges")).toHaveLength(1);
    expect(await run(bob, "myNudges")).toEqual([]);
    await run(alice, "markNudgesSeen");
    expect(await run(alice, "myNudges")).toEqual([]);
  });

  it("blocks direct writes to group tables", async () => {
    await expect(
      withUser(carol, (db) => db.query("insert into public.group_members (group_id, user_id, sprint_id, display_name) values ($1,$2,$3,'x')", [groupId, carol, sprintId])),
    ).rejects.toMatchObject({ code: "42501" });
  });

  it("enforces owner rules", async () => {
    await expect(run(bob, "removeMember", { groupId, userId: alice })).rejects.toThrow("Only the owner");
    await expect(run(alice, "leaveGroup", { groupId })).rejects.toThrow("Owners delete");
    await run(alice, "removeMember", { groupId, userId: bob });
    expect(await run(bob, "getGroup", { id: groupId })).toBeNull();
    await run(alice, "deleteGroup", { groupId });
    expect(await run(alice, "listMyGroups")).toEqual([]);
  });
});
