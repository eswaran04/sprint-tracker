import { describe, expect, it } from "vitest";
import { relativeRedirect } from "./redirect";

describe("relativeRedirect", () => {
  it("sends a relative Location so the browser keeps the public host", () => {
    const res = relativeRedirect("/", 303);
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("/");
  });

  it("defaults to 307", () => {
    expect(relativeRedirect("/app").status).toBe(307);
  });

  it("rejects absolute and protocol-relative targets", () => {
    expect(() => relativeRedirect("https://evil.example/")).toThrow();
    expect(() => relativeRedirect("//evil.example/")).toThrow();
  });
});
