import { describe, expect, it } from "vitest";
import { authProxyRewrites } from "./auth-proxy";

describe("authProxyRewrites", () => {
  it("proxies the Firebase auth helper to the project's firebaseapp.com", () => {
    expect(authProxyRewrites("sprint-tracker-126ab")).toEqual([
      { source: "/__/auth/:path*", destination: "https://sprint-tracker-126ab.firebaseapp.com/__/auth/:path*" },
    ]);
  });

  it("adds nothing without a project id", () => {
    expect(authProxyRewrites(undefined)).toEqual([]);
    expect(authProxyRewrites("")).toEqual([]);
  });
});
