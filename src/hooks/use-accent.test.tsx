import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const saveAccent = vi.hoisted(() => vi.fn<(id: string) => Promise<void>>(async () => {}));
vi.mock("@/lib/api", () => ({ saveAccent }));

import { applyAccent, useAccent } from "./use-accent";

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  document.documentElement.setAttribute("data-accent", "violet");
});

describe("useAccent", () => {
  it("reads the current accent from <html>", () => {
    const { result } = renderHook(() => useAccent());
    expect(result.current[0]).toBe("violet");
  });

  it("applies, caches and syncs a new accent", async () => {
    const { result } = renderHook(() => useAccent({ syncToAccount: true }));
    act(() => result.current[1]("pink"));
    await waitFor(() => expect(result.current[0]).toBe("pink"));
    expect(document.documentElement.getAttribute("data-accent")).toBe("pink");
    expect(localStorage.getItem("accent")).toBe("pink");
    expect(saveAccent).toHaveBeenCalledWith("pink");
  });

  it("does not sync when signed out", () => {
    const { result } = renderHook(() => useAccent());
    act(() => result.current[1]("teal"));
    expect(localStorage.getItem("accent")).toBe("teal");
    expect(saveAccent).not.toHaveBeenCalled();
  });

  it("applyAccent ignores unknown ids", () => {
    applyAccent("nope");
    expect(document.documentElement.getAttribute("data-accent")).toBe("violet");
  });
});
