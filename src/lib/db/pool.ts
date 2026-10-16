import { Pool, types } from "pg";

// Keep `date` / `date[]` as yyyy-MM-dd strings (the client's contract), not JS Dates shifted to UTC.
types.setTypeParser(1082, (v: string) => v);
types.setTypeParser(1182 as never, types.getTypeParser(1009 as never)); // date[] parsed like text[]

const g = globalThis as unknown as { __pgPool?: Pool };

/** One pool per server process (reused across hot reloads in dev). */
export function pool(): Pool {
  g.__pgPool ??= new Pool({
    connectionString: process.env.DATABASE_URL,
    max: Number(process.env.DATABASE_POOL_MAX ?? 5),
    idleTimeoutMillis: 10_000,
  });
  return g.__pgPool;
}
