import { Connector, IpAddressTypes } from "@google-cloud/cloud-sql-connector";
import { Pool, types, type PoolConfig } from "pg";

// Keep `date` / `date[]` as yyyy-MM-dd strings (the client's contract), not JS Dates shifted to UTC.
types.setTypeParser(1082, (v: string) => v);
types.setTypeParser(1182 as never, types.getTypeParser(1009 as never)); // date[] parsed like text[]

const g = globalThis as unknown as { __pgPool?: Promise<Pool> };

/**
 * Cloud SQL (CLOUD_SQL_INSTANCE = "project:region:instance") connects through the Cloud SQL connector: IAM-authorized
 * TLS, so no IP allowlist is needed for App Hosting. Otherwise DATABASE_URL (local Postgres, or any other host).
 */
async function connection(): Promise<PoolConfig> {
  const instanceConnectionName = process.env.CLOUD_SQL_INSTANCE;
  if (!instanceConnectionName) return { connectionString: process.env.DATABASE_URL };
  const opts = await new Connector().getOptions({ instanceConnectionName, ipType: IpAddressTypes.PUBLIC });
  return { ...opts, user: process.env.DB_USER, password: process.env.DB_PASS, database: process.env.DB_NAME };
}

/** One pool per server process (reused across hot reloads in dev). */
export function pool(): Promise<Pool> {
  g.__pgPool ??= connection()
    .then(
      (config) =>
        new Pool({
          ...config,
          max: Number(process.env.DATABASE_POOL_MAX ?? 5),
          idleTimeoutMillis: 10_000,
        }),
    )
    .catch((e) => {
      g.__pgPool = undefined; // let the next request retry instead of caching the failure
      throw e;
    });
  return g.__pgPool;
}
