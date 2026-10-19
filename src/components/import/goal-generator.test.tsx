import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/render";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
const api = vi.hoisted(() => ({
  createSprint: vi.fn(async () => ({ id: "gen-id" })),
  generateSprint: vi.fn<(args: Record<string, unknown>) => Promise<Record<string, unknown>>>(async () => ({
    kind: "plan",
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

  it("asks clarifying questions, then sends the goal and answers back for the plan", async () => {
    const draft = {
      company: null, weeks: 4, hours_per_day: 2, weak_topics: [], focus_topics: [], skip_weekends: false,
      start_date: null, rest_days: [], difficulty_mix: { basic: 0.25, core: 0.5, pro: 0.25 }, title: "4 weeks",
    };
    const planImpl = api.generateSprint.getMockImplementation()!;
    api.generateSprint.mockClear();
    api.generateSprint.mockImplementationOnce(async () => ({
      kind: "questions",
      goal: draft,
      ai: true,
      questions: [
        { field: "weeks", kind: "number", prompt: "How many weeks until your interview?", min: 1, max: 52, step: 1, unit: "weeks", default: 4 },
        { field: "company", kind: "single", prompt: "Are you preparing for a specific company?", options: ["Google", "Amazon"], default: null },
        { field: "weak_topics", kind: "multi", prompt: "Any topics you're weak at?", options: ["Dynamic Programming", "Graphs"], default: [] },
      ],
    }));
    api.generateSprint.mockImplementationOnce(planImpl);

    const user = userEvent.setup();
    renderWithProviders(<GoalGenerator />);
    await user.type(screen.getByLabelText("Describe your goal"), "help me prep for interviews");
    await user.click(screen.getByRole("button", { name: /Generate sprint/ }));

    expect(await screen.findByText("Are you preparing for a specific company?")).toBeInTheDocument();
    const weeks = screen.getByRole("spinbutton");
    await user.clear(weeks);
    await user.type(weeks, "6");
    await user.click(screen.getByRole("button", { name: "Google" }));
    await user.click(screen.getByRole("button", { name: "Dynamic Programming" }));
    await user.click(screen.getByRole("button", { name: /Build my plan/ }));

    expect(await screen.findByText("DP foundations", { exact: false })).toBeInTheDocument();
    expect(screen.queryByText("Are you preparing for a specific company?")).not.toBeInTheDocument();
    expect(api.generateSprint).toHaveBeenCalledTimes(2);
    expect(api.generateSprint.mock.calls[1][0]).toMatchObject({
      prompt: "help me prep for interviews",
      goal: draft,
      answers: { weeks: 6, company: "Google", weak_topics: ["Dynamic Programming"] },
    });
  });

  it("can skip the questions and use defaults", async () => {
    const planImpl = api.generateSprint.getMockImplementation()!;
    api.generateSprint.mockClear();
    api.generateSprint.mockImplementationOnce(async () => ({
      kind: "questions",
      goal: { company: null, weeks: 4, hours_per_day: 2, weak_topics: [], focus_topics: [], skip_weekends: false, start_date: null, rest_days: [], difficulty_mix: { basic: 0.25, core: 0.5, pro: 0.25 }, title: "4 weeks" },
      ai: false,
      questions: [{ field: "hours_per_day", kind: "number", prompt: "How many hours can you study on a study day?", min: 0.5, max: 12, step: 0.5, default: 2 }],
    }));
    api.generateSprint.mockImplementationOnce(planImpl);

    const user = userEvent.setup();
    renderWithProviders(<GoalGenerator />);
    await user.type(screen.getByLabelText("Describe your goal"), "prep for interviews");
    await user.click(screen.getByRole("button", { name: /Generate sprint/ }));
    await user.click(await screen.findByRole("button", { name: /Skip – use defaults/ }));

    expect(await screen.findByText("DP foundations", { exact: false })).toBeInTheDocument();
    expect(api.generateSprint.mock.calls[1][0]).toMatchObject({ skip_questions: true });
    expect(api.generateSprint.mock.calls[1][0]).not.toHaveProperty("answers");
  });
});
