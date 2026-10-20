import type { PoolClient } from "pg";
import { pool } from "./pool";

/**
 * Runs `fn` in a transaction as role `authenticated` with `app.uid` = the Firebase uid, so RLS applies.
 * Both settings are transaction-local and reset on commit/rollback, so pooled connections never leak identity.
 */
export async function withUser<T>(uid: string, fn: (db: PoolClient) => Promise<T>): Promise<T> {
  if (!uid) throw new Error("withUser requires a uid");
  const db = await (await pool()).connect();
  try {
    await db.query("begin");
    await db.query("set local role authenticated");
    await db.query("select set_config('app.uid', $1, true)", [uid]);
    const out = await fn(db);
    await db.query("commit");
    return out;
  } catch (e) {
    await db.query("rollback").catch(() => {});
    throw e;
  } finally {
    db.release();
  }
}

/** Server-only profile upsert (runs as the app role, outside RLS). */
export async function upsertUser(u: { uid: string; email: string; name: string | null; picture: string | null }) {
  await (await pool()).query(
    `insert into app.users (id, email, display_name, avatar_url) values ($1, $2, $3, $4)
     on conflict (id) do update set email = excluded.email,
       display_name = coalesce(excluded.display_name, app.users.display_name),
       avatar_url = coalesce(excluded.avatar_url, app.users.avatar_url), updated_at = now()`,
    [u.uid, u.email, u.name, u.picture],
  );
}

export async function getUserRow(uid: string) {
  const { rows } = await (await pool()).query<{ display_name: string | null; avatar_url: string | null; accent: string | null }>(
    "select display_name, avatar_url, accent from app.users where id = $1",
    [uid],
  );
  return rows[0] ?? null;
}

export async function setAccent(uid: string, accent: string) {
  await (await pool()).query("update app.users set accent = $2, updated_at = now() where id = $1", [uid, accent]);
}
