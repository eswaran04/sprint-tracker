import { act, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { setPaletteContext, setPaletteOpen } from "@/lib/palette-store";
import { mkProblem } from "@/test/fixtures/problems";
import { renderWithProviders } from "@/test/render";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/lib/api", () => ({
  listSprints: vi.fn(async () => [{ id: "s1", title: "DSA Prep", total: 2, done: 0 }]),
  listMyGroups: vi.fn(async () => []),
}));

import { CommandPalette } from "./command-palette";

describe("CommandPalette", () => {
  it("opens, searches problems, and selects one", async () => {
    const user = userEvent.setup();
    const onSelectProblem = vi.fn();
    const twoSum = mkProblem({ name: "Two Sum", companies: ["Google"] });
    setPaletteContext({ problems: [twoSum, mkProblem({ name: "Reverse Pairs" })], onSelectProblem, actions: [] });
    renderWithProviders(<CommandPalette />);

    act(() => setPaletteOpen(true));
    await user.type(await screen.findByPlaceholderText(/Search problems/), "two");
    expect(screen.getByText("Two Sum")).toBeInTheDocument();
    expect(screen.queryByText("Reverse Pairs")).not.toBeInTheDocument();

    await user.keyboard("{Enter}");
    expect(onSelectProblem).toHaveBeenCalledWith(twoSum);
  });

  it("offers Filter with AI for sentence-like input and calls aiFilter", async () => {
    const user = userEvent.setup();
    const aiFilter = vi.fn(async () => {});
    setPaletteContext({ problems: [mkProblem({ name: "Two Sum" })], onSelectProblem: vi.fn(), actions: [], aiFilter });
    renderWithProviders(<CommandPalette />);

    act(() => setPaletteOpen(true));
    const input = await screen.findByPlaceholderText(/Search problems/);
    await user.type(input, "amazon dp");
    expect(screen.queryByText(/Filter with AI/)).not.toBeInTheDocument();

    await user.type(input, " unsolved");
    const item = await screen.findByText(/Filter with AI: “amazon dp unsolved”/);
    await user.click(item);
    expect(aiFilter).toHaveBeenCalledWith("amazon dp unsolved");
  });

  it("hides the AI item when the page has no aiFilter", async () => {
    const user = userEvent.setup();
    setPaletteContext({ problems: [], onSelectProblem: vi.fn(), actions: [] });
    renderWithProviders(<CommandPalette />);
    act(() => setPaletteOpen(true));
    await user.type(await screen.findByPlaceholderText(/Search problems/), "amazon dp unsolved");
    expect(screen.queryByText(/Filter with AI/)).not.toBeInTheDocument();
  });
});
