import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/firebase/admin", () => ({ adminAuth: vi.fn() }));
vi.mock("@/lib/db/session", () => ({ upsertUser: vi.fn() }));

import { POST } from "./route";

const APP = "sprintboard--sprint-tracker-126ab.asia-southeast1.hosted.app";

/** Behind App Hosting the server sees its internal URL; the public host arrives in headers. */
function post(headers: Record<string, string>) {
  return POST(new NextRequest("http://0.0.0.0:8080/auth/callback", { method: "POST", headers, body: "{}" }));
}

describe("POST /auth/callback origin check", () => {
  it("accepts the public origin when it matches x-forwarded-host", async () => {
    const res = await post({ origin: `https://${APP}`, "x-forwarded-host": APP, host: "0.0.0.0:8080" });
    expect(res.status).toBe(400); // past the CSRF check, rejected for the missing token
  });

  it("accepts an origin matching the host header when no proxy header is set", async () => {
    const res = await post({ origin: "http://localhost:3000", host: "localhost:3000" });
    expect(res.status).toBe(400);
  });

  it("rejects a cross-site origin", async () => {
    const res = await post({ origin: "https://evil.example", "x-forwarded-host": APP });
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "Bad origin" });
  });

  it("rejects a malformed origin", async () => {
    const res = await post({ origin: "null", host: APP });
    expect(res.status).toBe(403);
  });
});
