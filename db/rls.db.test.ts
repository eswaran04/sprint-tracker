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
  await (await pool()).end();
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

describe("share reports (viral loop)", () => {
  const app = async (sql: string, params: unknown[] = []) => (await pool()).query(sql, params); // app role, like src/lib/db/share.ts
  const slug = `sheet-${tag}`;
  const report = { readiness: "[]", scout: '{"line1":"a","line2":"b","strengths":[],"weaknesses":[],"ai":false}', stats: '{"pct":33}' };
  let privateSprint: string;

  beforeAll(async () => {
    // A private sprint with progress and notes: sharing must not require publishing it.
    const s = await run(alice, "createSprint", { input: { title: "Private", start_date: "2026-10-01", skip_weekends: false }, rows });
    privateSprint = s.id;
    const { problems } = await run(alice, "getSprint", { id: privateSprint });
    await run(alice, "updateProblem", { id: problems[0].id, patch: { done_at: new Date().toISOString(), notes: "secret", starred: true } });
  });

  it("has no public image or roadmap before the owner generates a report", async () => {
    expect((await app("select * from public.share_report_for_sprint($1)", [privateSprint])).rows).toEqual([]);
    expect((await app("select * from public.shared_roadmap($1)", [slug])).rows).toEqual([]);
  });

  it("lets only the owner write a report, and only for their own sprint", async () => {
    const insert = (uid: string, sprint: string, s: string) =>
      withUser(uid, (db) =>
        db.query("insert into public.share_reports (slug, sprint_id, title, readiness, scout, stats) values ($1, $2, 'Private', $3, $4, $5)", [
          s, sprint, report.readiness, report.scout, report.stats,
        ]),
      );
    await expect(insert(bob, privateSprint, `bob-${tag}`)).rejects.toMatchObject({ code: "42501" });
    await insert(alice, privateSprint, slug);
    expect(await run(alice, "getMyShareReport", { id: privateSprint })).toMatchObject({ slug, title: "Private" });
    expect(await run(bob, "getMyShareReport", { id: privateSprint })).toBeNull();
    const upd = await withUser(bob, (db) => db.query("update public.share_reports set title = 'x' where slug = $1", [slug]));
    const del = await withUser(bob, (db) => db.query("delete from public.share_reports where slug = $1", [slug]));
    expect([upd.rowCount, del.rowCount]).toEqual([0, 0]);
  });

  it("serves the snapshot and a roadmap without notes, stars or timestamps", async () => {
    const [snap] = (await app("select * from public.share_report($1)", [slug])).rows;
    expect(snap).toMatchObject({ slug, sprint_id: privateSprint, title: "Private" });
    expect((await app("select * from public.share_report_for_sprint($1)", [privateSprint])).rows[0].slug).toBe(slug);
    const roadmap = (await app("select * from public.shared_roadmap($1)", [slug])).rows;
    expect(roadmap.map((p) => p.done)).toEqual([true, false, false]);
    for (const col of ["notes", "starred", "done_at", "id", "user_id"]) expect(roadmap[0]).not.toHaveProperty(col);
  });

  it("clones idempotently for others, returns the source to its owner, and bumps copy_count", async () => {
    await expect(withUser("", () => Promise.resolve())).rejects.toThrow();
    await expect(app("select public.clone_shared_sprint($1)", [slug])).rejects.toThrow(/permission denied|Not signed in/);
    await expect(run(bob, "cloneSharedSprint", { slug: "nope-000000" })).rejects.toThrow("no longer active");

    const copy = await run<string>(bob, "cloneSharedSprint", { slug });
    expect(await run<string>(bob, "cloneSharedSprint", { slug })).toBe(copy);
    expect(await run<string>(alice, "cloneSharedSprint", { slug })).toBe(privateSprint);

    const { sprint, problems } = await run(bob, "getSprint", { id: copy });
    expect(sprint).toMatchObject({ user_id: bob, copied_from: privateSprint, visibility: "private" });
    expect(problems.every((p: { done_at: unknown; notes: string; starred: boolean }) => !p.done_at && !p.notes && !p.starred)).toBe(true);
    expect((await run(alice, "getSprint", { id: privateSprint })).sprint.copy_count).toBe(1);
  });

  it("stops working everywhere once deleted", async () => {
    await withUser(alice, (db) => db.query("delete from public.share_reports where slug = $1", [slug]));
    expect((await app("select * from public.share_report($1)", [slug])).rows).toEqual([]);
    expect((await app("select * from public.shared_roadmap($1)", [slug])).rows).toEqual([]);
    await expect(run(carol, "cloneSharedSprint", { slug })).rejects.toThrow("no longer active");
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

  it("keeps 2-argument send_nudge calls working (message defaults to null)", async () => {
    await withUser(alice, (db) => db.query("select public.send_nudge($1, $2)", [groupId, bob]));
    const [n] = await run(bob, "myNudges");
    expect(n).toMatchObject({ sender_name: "Alice", message: null });
    await run(bob, "markNudgesSeen");
  });

  it("stores a cleaned message that only the target can read", async () => {
    // Both pairs in the first group were used today (24h limit), so use a fresh pair in a second group.
    const carolSprint = await run(carol, "createSprint", { input: { title: "Carol", start_date: null, skip_weekends: false }, rows });
    const g2 = await run<string>(carol, "createGroup", { sprintId: carolSprint.id, name: "Crew 2", me: me("Carol") });
    const { group } = await run(carol, "getGroup", { id: g2 });
    await run(alice, "joinGroup", { code: group.invite_code, me: me("Alice"), existingSprint: null });

    await expect(
      withUser(alice, (db) => db.query("select public.send_nudge($1, $2, $3)", [g2, carol, "x".repeat(141)])),
    ).rejects.toThrow("under 140 characters");
    expect(() => ops.sendNudge.args.parse({ groupId: g2, targetUser: carol, message: "x".repeat(141) })).toThrow();
    expect(ops.sendNudge.args.parse({ groupId: g2, targetUser: carol, message: "   " })).toMatchObject({ message: null });

    await run(alice, "sendNudge", { groupId: g2, targetUser: carol, message: "  LRU\ntonight?\t " });
    expect((await run(carol, "myNudges"))[0]).toMatchObject({ group_name: "Crew 2", message: "LRU tonight?" });
    expect(await run(alice, "myNudges")).toEqual([]);
    const direct = await withUser(alice, (db) => db.query("select message from public.group_nudges where group_id = $1", [g2]));
    expect(direct.rows).toEqual([]);
    await expect(run(alice, "sendNudge", { groupId: g2, targetUser: carol, message: "again" })).rejects.toThrow("already nudged");
    await run(carol, "deleteGroup", { groupId: g2 });
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

describe("sheet embeddings (pgvector)", () => {
  // Synthetic 768-d vectors: mostly axis `i`, with a little of axis `j`, so distances are predictable without Vertex.
  const vec = (i: number, j = i, mix = 0) => `[${Array.from({ length: 768 }, (_, k) => (k === i ? 1 : 0) + (k === j ? mix : 0)).join(",")}]`;
  const app = async (sql: string, params: unknown[] = []) => (await pool()).query(sql, params); // app role, outside withUser
  const sheet = (uid: string, title: string) =>
    run(uid, "createSprint", { input: { title, start_date: null, skip_weekends: false }, rows }).then((s) => s.id as string);
  const ids = (list: { id: string }[]) => list.map((s) => s.id);
  let near: string, far: string, hidden: string;

  beforeAll(async () => {
    // alice's `sprintId` is public (published above). carol publishes two more and keeps one private.
    near = await sheet(carol, "Near");
    far = await sheet(carol, "Far");
    hidden = await sheet(carol, "Hidden");
    for (const id of [near, far]) await run(carol, "updateSprint", { id, patch: { visibility: "public" } });
    const put = (id: string, v: string) =>
      app(
        `insert into public.sheet_embeddings (sprint_id, content_hash, embedding) values ($1, 'h', $2::vector)
         on conflict (sprint_id) do update set embedding = excluded.embedding`,
        [id, v],
      );
    await put(sprintId, vec(0));
    await put(near, vec(0, 1, 0.3));
    await put(far, vec(5));
    await put(hidden, vec(0, 1, 0.1)); // closest of all, but private
  });

  it("only exposes embeddings of public sheets", async () => {
    const { rows } = await withUser(bob, (db) => db.query("select sprint_id from public.sheet_embeddings where sprint_id = any($1)", [[sprintId, near, far, hidden]]));
    expect(rows.map((r) => r.sprint_id).sort()).toEqual([sprintId, near, far].sort());
  });

  it("does not let signed-in users write embeddings", async () => {
    await expect(
      withUser(carol, (db) => db.query("update public.sheet_embeddings set content_hash = 'x' where sprint_id = $1", [near])),
    ).rejects.toMatchObject({ code: "42501" });
    await expect(
      withUser(carol, (db) => db.query("insert into public.sheet_embeddings (sprint_id, content_hash, embedding) values ($1, 'x', $2::vector)", [hidden, vec(3)])),
    ).rejects.toMatchObject({ code: "42501" });
  });

  it("finds similar public sheets nearest first, excluding the source and private sheets", async () => {
    const similar = await run(bob, "similarSheets", { id: sprintId, k: 10 });
    expect(ids(similar).filter((id) => [near, far, hidden].includes(id))).toEqual([near, far]);
    expect(ids(similar)).not.toContain(sprintId);
    expect(similar[0]).toMatchObject({ id: near, title: "Near", problem_count: 3 });
    // A private source returns nothing, even to its owner.
    expect(await run(carol, "similarSheets", { id: hidden })).toEqual([]);
  });

  it("recommends by goal, skipping your own and copied sheets", async () => {
    expect(await run(bob, "recommendedSheets", {})).toEqual([]); // no goal yet
    await app("update app.users set goal = 'arrays', goal_embedding = $2::vector where id = $1", [bob, vec(0)]);
    const forBob = ids(await run(bob, "recommendedSheets", { k: 10 }));
    expect(forBob).not.toContain(sprintId); // bob already copied alice's sheet
    expect(forBob).not.toContain(hidden);
    expect(forBob.filter((id) => [near, far].includes(id))).toEqual([near, far]);

    await app("update app.users set goal_embedding = $2::vector where id = $1", [carol, vec(0)]);
    const forCarol = ids(await run(carol, "recommendedSheets", { k: 10 }));
    expect(forCarol).toContain(sprintId);
    expect(forCarol).not.toContain(near); // her own
  });

  it("drops embeddings when a sheet is deleted", async () => {
    await run(carol, "deleteSprint", { id: far });
    expect((await app("select 1 from public.sheet_embeddings where sprint_id = $1", [far])).rowCount).toBe(0);
  });
});
