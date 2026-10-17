import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { Pool, getOptions } = vi.hoisted(() => ({
  Pool: vi.fn(function (this: { config: unknown }, config: unknown) {
    this.config = config;
  }),
  getOptions: vi.fn(async () => ({ stream: "connector-stream" })),
}));

vi.mock("pg", () => ({ Pool, types: { setTypeParser: vi.fn(), getTypeParser: vi.fn() } }));
vi.mock("@google-cloud/cloud-sql-connector", () => ({
  Connector: vi.fn(function () {
    return { getOptions };
  }),
  IpAddressTypes: { PUBLIC: "PUBLIC" },
}));

async function freshPool() {
  vi.resetModules();
  delete (globalThis as { __pgPool?: unknown }).__pgPool;
  return (await import("./pool")).pool;
}

describe("pool", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    Pool.mockClear();
    getOptions.mockClear();
  });
  afterEach(() => vi.unstubAllEnvs());

  it("uses DATABASE_URL when no Cloud SQL instance is configured", async () => {
    vi.stubEnv("CLOUD_SQL_INSTANCE", "");
    vi.stubEnv("DATABASE_URL", "postgres://u:p@localhost:5432/db");
    const pool = await freshPool();
    await pool();
    expect(getOptions).not.toHaveBeenCalled();
    expect(Pool).toHaveBeenCalledWith(expect.objectContaining({ connectionString: "postgres://u:p@localhost:5432/db" }));
  });

  it("connects through the Cloud SQL connector when CLOUD_SQL_INSTANCE is set", async () => {
    vi.stubEnv("CLOUD_SQL_INSTANCE", "proj:asia-south1:sprintboard");
    vi.stubEnv("DB_USER", "sprintboard_app");
    vi.stubEnv("DB_PASS", "secret");
    vi.stubEnv("DB_NAME", "sprintboard");
    const pool = await freshPool();
    await pool();
    expect(getOptions).toHaveBeenCalledWith({ instanceConnectionName: "proj:asia-south1:sprintboard", ipType: "PUBLIC" });
    expect(Pool).toHaveBeenCalledWith(
      expect.objectContaining({ stream: "connector-stream", user: "sprintboard_app", password: "secret", database: "sprintboard" }),
    );
    expect(Pool.mock.calls[0][0]).not.toHaveProperty("connectionString");
  });

  it("creates one pool per process", async () => {
    vi.stubEnv("CLOUD_SQL_INSTANCE", "proj:asia-south1:sprintboard");
    const pool = await freshPool();
    const [a, b] = await Promise.all([pool(), pool()]);
    expect(a).toBe(b);
    expect(Pool).toHaveBeenCalledTimes(1);
    expect(getOptions).toHaveBeenCalledTimes(1);
  });
});
