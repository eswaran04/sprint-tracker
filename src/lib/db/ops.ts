import type { PoolClient } from "pg";
import { z } from "zod";

/**
 * Every data operation the browser may perform. Each runs inside `withUser`, so Postgres RLS and the
 * security-definer functions see the caller's Firebase uid via `app.uid()`. All SQL is parameterised;
 * column names in patches come from fixed allowlists, never from the request.
 */

export class OpError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
  }
}

const id = z.uuid();
const uid = z.string().min(1).max(128);
const day = z.iso.date();
const str = (max: number) => z.string().max(max);
const me = z.object({ name: str(200), avatar: str(2000).nullable() });

const sprintPatch = z
  .object({
    title: str(200),
    start_date: day.nullable(),
    skip_weekends: z.boolean(),
    rest_days: z.array(day).max(2000),
    visibility: z.enum(["private", "public"]),
    description: str(5000),
    show_owner: z.boolean(),
    owner_name: str(200).nullable(),
    owner_avatar: str(2000).nullable(),
    published_at: z.string().nullable(),
  })
  .partial()
  .strict();

const problemPatch = z
  .object({
    done_at: z.string().nullable(),
    starred: z.boolean(),
    notes: str(200_000),
    day_no: z.number().int(),
    sprint_no: z.number().int(),
  })
  .partial()
  .strict();

const problemInput = z.object({
  position: z.number().int(),
  name: str(1000),
  url: str(4000),
  subject: str(200),
  difficulty: z.enum(["Basic", "Core", "Pro"]).nullable(),
  companies: z.array(str(200)).max(500),
  topics: z.array(str(200)).max(500),
  sprint_no: z.number().int(),
  day_no: z.number().int(),
});

async function update(db: PoolClient, table: "sprints" | "problems", rowId: string, patch: Record<string, unknown>) {
  const cols = Object.keys(patch); // already restricted by a .strict() schema
  if (!cols.length) return null;
  const sets = cols.map((c, i) => `"${c}" = $${i + 2}`).join(", ");
  const { rowCount } = await db.query(`update public.${table} set ${sets} where id = $1`, [rowId, ...cols.map((c) => patch[c])]);
  if (!rowCount) throw new OpError("Not found", 404);
  return null;
}

const one = async (db: PoolClient, sql: string, params: unknown[] = []) => (await db.query(sql, params)).rows[0] ?? null;
const all = async (db: PoolClient, sql: string, params: unknown[] = []) => (await db.query(sql, params)).rows;
const scalar = async (db: PoolClient, sql: string, params: unknown[] = []) => (await db.query(sql, params)).rows[0]?.v ?? null;

type Op = { args: z.ZodType; run: (db: PoolClient, args: never) => Promise<unknown> };
const op = <S extends z.ZodType>(args: S, run: (db: PoolClient, a: z.infer<S>) => Promise<unknown>): Op => ({ args, run } as Op);
const none = z.object({}).strict();

export const ops = {
  listSprints: op(none, (db) =>
    all(
      db,
      `select s.*,
              (select count(*)::int from public.problems p where p.sprint_id = s.id) as total,
              (select count(*)::int from public.problems p where p.sprint_id = s.id and p.done_at is not null) as done
         from public.sprints s order by s.created_at desc`,
    ),
  ),

  getSprint: op(z.object({ id }), async (db, { id }) => {
    const sprint = await one(db, "select * from public.sprints where id = $1", [id]);
    if (!sprint) throw new OpError("Sprint not found", 404);
    const problems = await all(db, "select * from public.problems where sprint_id = $1 order by position", [id]);
    return { sprint, problems };
  }),

  createSprint: op(
    z.object({
      input: z.object({ title: str(200), start_date: day.nullable(), skip_weekends: z.boolean() }),
      rows: z.array(problemInput).max(20_000),
    }),
    async (db, { input, rows }) => {
      const sprint = await one(
        db,
        "insert into public.sprints (title, start_date, skip_weekends) values ($1, $2, $3) returning *",
        [input.title, input.start_date, input.skip_weekends],
      );
      if (rows.length) {
        await db.query(
          `insert into public.problems
             (sprint_id, position, name, url, subject, difficulty, companies, topics,
              sprint_no, day_no, original_day_no, original_sprint_no)
           select $1, r.position, r.name, r.url, r.subject, r.difficulty, r.companies, r.topics,
                  r.sprint_no, r.day_no, r.day_no, r.sprint_no
             from jsonb_to_recordset($2::jsonb) as r(position int, name text, url text, subject text, difficulty text,
                  companies text[], topics text[], sprint_no int, day_no int)`,
          [sprint.id, JSON.stringify(rows)],
        );
      }
      return sprint;
    },
  ),

  updateSprint: op(z.object({ id, patch: sprintPatch }), (db, { id, patch }) => update(db, "sprints", id, patch)),

  deleteSprint: op(z.object({ id }), async (db, { id }) => {
    await db.query("delete from public.sprints where id = $1", [id]);
    return null;
  }),

  updateProblem: op(z.object({ id, patch: problemPatch }), (db, { id, patch }) => update(db, "problems", id, patch)),

  reschedule: op(
    z.object({ changes: z.array(z.object({ id, day_no: z.number().int(), sprint_no: z.number().int() })).max(20_000) }),
    async (db, { changes }) => {
      if (changes.length) await db.query("select public.reschedule_problems($1::jsonb)", [JSON.stringify(changes)]);
      return null;
    },
  ),

  listSavedFilters: op(none, (db) => all(db, "select * from public.saved_filters order by created_at")),

  createSavedFilter: op(z.object({ name: str(200), query: z.record(z.string(), z.unknown()) }), (db, { name, query }) =>
    one(db, "insert into public.saved_filters (name, query) values ($1, $2::jsonb) returning *", [name, JSON.stringify(query)]),
  ),

  deleteSavedFilter: op(z.object({ id }), async (db, { id }) => {
    await db.query("delete from public.saved_filters where id = $1", [id]);
    return null;
  }),

  listPublicSheets: op(none, (db) => all(db, "select * from public.public_sheets order by published_at desc nulls last limit 500")),

  getPublicSheet: op(z.object({ id }), async (db, { id }) => {
    const sheet = await one(db, "select * from public.public_sheets where id = $1", [id]);
    if (!sheet) return null;
    const problems = await all(db, "select * from public.public_sheet_problems where sprint_id = $1 order by position", [id]);
    return { sheet, problems };
  }),

  copyPublicSheet: op(z.object({ id }), (db, { id }) => scalar(db, "select public.copy_public_sheet($1) as v", [id])),

  listMyGroups: op(none, (db) => all(db, "select * from public.my_groups()")),

  getGroup: op(z.object({ id }), async (db, { id }) => {
    const group = await one(db, "select * from public.groups where id = $1", [id]);
    if (!group) return null;
    const members = await all(db, "select * from public.group_members where group_id = $1 order by joined_at", [id]);
    return { group, members };
  }),

  groupPreview: op(z.object({ code: str(64) }), (db, { code }) => one(db, "select * from public.group_preview($1)", [code])),

  createGroup: op(z.object({ sprintId: id, name: str(200), me }), (db, a) =>
    scalar(db, "select public.create_group($1, $2, $3, $4) as v", [a.sprintId, a.name, a.me.name, a.me.avatar]),
  ),

  joinGroup: op(z.object({ code: str(64), me, existingSprint: id.nullable() }), (db, a) =>
    scalar(db, "select public.join_group($1, $2, $3, $4) as v", [a.code, a.me.name, a.me.avatar, a.existingSprint]),
  ),

  groupProgress: op(z.object({ groupId: id }), (db, { groupId }) => all(db, "select * from public.group_progress($1)", [groupId])),

  groupActivity: op(z.object({ groupId: id }), (db, { groupId }) => all(db, "select * from public.group_activity($1)", [groupId])),

  groupReactions: op(z.object({ groupId: id, sinceDay: day }), (db, { groupId, sinceDay }) =>
    all(
      db,
      "select group_id, target_user, to_char(day, 'YYYY-MM-DD') as day, reactor from public.group_reactions where group_id = $1 and day >= $2",
      [groupId, sinceDay],
    ),
  ),

  toggleReaction: op(z.object({ groupId: id, targetUser: uid, day }), async (db, a) => {
    await db.query("select public.toggle_reaction($1, $2, $3)", [a.groupId, a.targetUser, a.day]);
    return null;
  }),

  sendNudge: op(z.object({ groupId: id, targetUser: uid }), async (db, a) => {
    await db.query("select public.send_nudge($1, $2)", [a.groupId, a.targetUser]);
    return null;
  }),

  myNudges: op(none, (db) => all(db, "select * from public.my_nudges()")),

  markNudgesSeen: op(none, async (db) => {
    await db.query("select public.mark_nudges_seen()");
    return null;
  }),

  leaveGroup: op(z.object({ groupId: id }), async (db, { groupId }) => {
    await db.query("select public.leave_group($1)", [groupId]);
    return null;
  }),

  removeMember: op(z.object({ groupId: id, userId: uid }), async (db, a) => {
    await db.query("select public.remove_member($1, $2)", [a.groupId, a.userId]);
    return null;
  }),

  deleteGroup: op(z.object({ groupId: id }), async (db, { groupId }) => {
    await db.query("select public.delete_group($1)", [groupId]);
    return null;
  }),
} satisfies Record<string, Op>;

export type OpName = keyof typeof ops;
export const isOp = (name: string): name is OpName => Object.hasOwn(ops, name);
