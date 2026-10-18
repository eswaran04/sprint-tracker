import { describe, expect, it } from "vitest";
import { emulatorUrl } from "./client";

describe("emulatorUrl", () => {
  it("uses the page's loopback hostname so the emulator iframe is same-site", () => {
    expect(emulatorUrl("127.0.0.1:9099", "localhost")).toBe("http://localhost:9099");
    expect(emulatorUrl("localhost:9099", "127.0.0.1")).toBe("http://127.0.0.1:9099");
  });

  it("keeps the configured host when it already matches or isn't loopback", () => {
    expect(emulatorUrl("127.0.0.1:9099", "127.0.0.1")).toBe("http://127.0.0.1:9099");
    expect(emulatorUrl("127.0.0.1:9099", "192.168.1.5")).toBe("http://127.0.0.1:9099");
    expect(emulatorUrl("emulator:9099", "localhost")).toBe("http://emulator:9099");
    expect(emulatorUrl("127.0.0.1:9099")).toBe("http://127.0.0.1:9099");
  });
});
