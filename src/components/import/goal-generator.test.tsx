import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/render";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
const api = vi.hoisted(() => ({
  createSprint: vi.fn(async () => ({ id: "gen-id" })),
  generateSprint: vi.fn(async () => ({
    goal: {
      company: "Google", weeks: 6, hours_per_day: 2, weak_topics: ["Dynamic Programming"], focus_topics: [], skip_weekends: true,
      start_date: null, rest_days: [], difficulty_mix: { basic: 0.2, core: 0.5, pro: 0.3 }, title: "Google SDE-2 · 6 weeks",
    },
    title: "Google SDE-2 · 6 weeks",
    start_date: "2026-10-05",
    skip_weekends: true,
    rest_days: ["2026-10-07"],
    rows: [
      { position: 0, name: "Climbing Stairs", url: "https://leetcode.com/problems/climbing-stairs/", subject: "dsa", difficulty: "Basic", companies: ["Google"], topics: ["Dynamic Programming"], sprint_no: 1, day_no: 1 },
      { position: 1, name: "Coin Change", url: "https://leetcode.com/problems/coin-change/", subject: "dsa", difficulty: "Core", companies: ["Google"], topics: ["Dynamic Programming"], sprint_no: 1, day_no: 2 },
    ],
    sprints: [{ sprint_no: 1, theme: "DP foundations" }],
    rationale: "DP first, then graphs.",
    warnings: ["Only 2 Google-tagged problems found; filled the rest with topic matches."],
    ai: true,
  })),
}));
vi.mock("@/lib/api", () => api);

import { GoalGenerator } from "./goal-generator";

describe("GoalGenerator", () => {
  it("generates a plan, previews it, and creates the sprint with schedule settings", async () => {
    const user = userEvent.setup();
    renderWithProviders(<GoalGenerator />);

    await user.click(screen.getByRole("button", { name: /Google SDE-2 interview in 6 weeks/ }));
    await user.click(screen.getByRole("button", { name: /Generate sprint/ }));

    expect(await screen.findByText("DP foundations", { exact: false })).toBeInTheDocument();
    expect(api.generateSprint).toHaveBeenCalledWith(expect.objectContaining({ prompt: expect.stringContaining("Google SDE-2") }));
    expect(screen.getByText("DP first, then graphs.")).toBeInTheDocument();
    expect(screen.getByText(/Only 2 Google-tagged/)).toBeInTheDocument();
    expect(screen.getByText("Coin Change")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Google SDE-2 · 6 weeks")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Create sprint with 2 problems/ }));
    await waitFor(() => expect(api.createSprint).toHaveBeenCalled());
    const [input, rows] = api.createSprint.mock.calls[0] as unknown as [Record<string, unknown>, unknown[]];
    expect(input).toEqual({ title: "Google SDE-2 · 6 weeks", start_date: "2026-10-05", skip_weekends: true, rest_days: ["2026-10-07"] });
    expect(rows).toHaveLength(2);
    expect(push).toHaveBeenCalledWith("/app/s/gen-id");
  });
});
