// Applies db/migrations/*.sql in filename order, once each. Uses MIGRATION_DATABASE_URL (an owner/admin role)
// and falls back to DATABASE_URL.
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import pg from "pg";

const url = process.env.MIGRATION_DATABASE_URL ?? process.env.DATABASE_URL;
if (!url) {
  console.error("Set MIGRATION_DATABASE_URL or DATABASE_URL");
  process.exit(1);
}

const dir = join(process.cwd(), "db/migrations");
const client = new pg.Client({ connectionString: url });
await client.connect();
try {
  await client.query(`create table if not exists public.schema_migrations (
    name text primary key, applied_at timestamptz not null default now())`);
  await client.query("revoke all on public.schema_migrations from public");
  const done = new Set((await client.query("select name from public.schema_migrations")).rows.map((r) => r.name));
  const files = (await readdir(dir)).filter((f) => f.endsWith(".sql")).sort();
  for (const file of files) {
    if (done.has(file)) continue;
    const sql = await readFile(join(dir, file), "utf8");
    process.stdout.write(`applying ${file} ... `);
    await client.query("begin");
    try {
      await client.query(sql);
      await client.query("insert into public.schema_migrations (name) values ($1)", [file]);
      await client.query("commit");
      console.log("ok");
    } catch (e) {
      await client.query("rollback");
      console.log("failed");
      throw e;
    }
  }
  console.log("migrations up to date");
} finally {
  await client.end();
}
