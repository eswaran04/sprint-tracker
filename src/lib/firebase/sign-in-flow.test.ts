import { beforeEach, describe, expect, it } from "vitest";
import { hasRememberedNext, prefersRedirectSignIn, rememberNext, safeNextPath, takeRememberedNext } from "./sign-in-flow";

const IPHONE_CHROME =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/138.0 Mobile/15E148 Safari/604.1";
const IPAD_DESKTOP_UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Safari/605.1.15";
const ANDROID = "Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0 Mobile Safari/537.36";
const DESKTOP_CHROME = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0 Safari/537.36";

describe("prefersRedirectSignIn", () => {
  it("uses redirect on iOS, iPadOS and Android", () => {
    expect(prefersRedirectSignIn(IPHONE_CHROME)).toBe(true);
    expect(prefersRedirectSignIn(IPAD_DESKTOP_UA, 5)).toBe(true);
    expect(prefersRedirectSignIn(ANDROID)).toBe(true);
  });

  it("keeps the popup on desktop, including a real Mac", () => {
    expect(prefersRedirectSignIn(DESKTOP_CHROME)).toBe(false);
    expect(prefersRedirectSignIn(IPAD_DESKTOP_UA, 0)).toBe(false);
  });
});

describe("safeNextPath", () => {
  it("keeps same-site paths and rejects everything else", () => {
    expect(safeNextPath("/app/sprints?x=1")).toBe("/app/sprints?x=1");
    for (const bad of [null, undefined, "", "app", "//evil.com", "/\\evil.com", "https://evil.com"]) {
      expect(safeNextPath(bad)).toBe("/app");
    }
  });
});

describe("remembered next", () => {
  beforeEach(() => sessionStorage.clear());

  it("round-trips once through sessionStorage", () => {
    expect(hasRememberedNext()).toBe(false);
    rememberNext("/app/groups");
    expect(hasRememberedNext()).toBe(true);
    expect(takeRememberedNext()).toBe("/app/groups");
    expect(hasRememberedNext()).toBe(false);
    expect(takeRememberedNext()).toBe("/app");
  });

  it("never stores an off-site target", () => {
    rememberNext("//evil.com");
    expect(takeRememberedNext()).toBe("/app");
  });
});
