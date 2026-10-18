import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { format, subDays } from "date-fns";
import { mkProblem, mkSprint } from "@/test/fixtures/problems";
import { renderWithProviders } from "@/test/render";
import { Toaster } from "sonner";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/app/s/s1",
  useSearchParams: () => new URLSearchParams(),
}));

const api = vi.hoisted(() => ({
  getSprint: vi.fn(),
  updateProblem: vi.fn(async () => {}),
  reschedule: vi.fn(async () => {}),
  updateSprint: vi.fn(async () => {}),
  listSavedFilters: vi.fn(async () => []),
  listSprints: vi.fn(async () => []),
  createSavedFilter: vi.fn(),
  deleteSavedFilter: vi.fn(),
  deleteSprint: vi.fn(),
  listMyGroups: vi.fn(async () => [] as unknown[]),
  getGroup: vi.fn(),
  groupProgress: vi.fn(async () => [] as unknown[]),
  createGroup: vi.fn(),
  aiFilters: vi.fn(),
  recallQuestion: vi.fn(),
  vivaQuestions: vi.fn(),
}));
vi.mock("@/lib/api", () => api);

import { SprintView } from "./sprint-view";

// Day 1 was two days ago → today is Day 3.
const sprint = mkSprint({ start_date: format(subDays(new Date(), 2), "yyyy-MM-dd") });
const problems = [
  mkProblem({ id: "a", name: "Linear Search", day_no: 1, original_day_no: 1, companies: ["Zoho"], done_at: "2026-10-01T10:00:00Z" }),
  mkProblem({ id: "b", name: "Largest Element", day_no: 1, original_day_no: 1, companies: ["Google"] }),
  mkProblem({ id: "c", name: "Two Sum", day_no: 3, original_day_no: 3, companies: ["Google", "Amazon"], topics: ["Hashing"] }),
  mkProblem({ id: "d", name: "Kadane's Algorithm", day_no: 5, original_day_no: 5, companies: ["Amazon"] }),
];

const dayHeader = (day: number) => screen.findByRole("button", { name: new RegExp(`^Day ${day}(?!\\d)`) });

beforeEach(() => {
  vi.clearAllMocks();
  api.listMyGroups.mockResolvedValue([]);
  api.getSprint.mockResolvedValue({ sprint, problems: structuredClone(problems) });
});

describe("SprintView", () => {
  it("renders the timeline with today and overdue state", async () => {
    const user = userEvent.setup();
    renderWithProviders(<SprintView id="s1" />);
    expect(await screen.findByRole("heading", { name: "DSA Prep" })).toBeInTheDocument();
    await user.click(await dayHeader(3));
    expect(screen.getByText("Two Sum")).toBeInTheDocument();
    expect(screen.getByText("1 overdue")).toBeInTheDocument();
    expect(screen.getAllByText("Today").length).toBeGreaterThan(0);
    expect(screen.getByText("Overdue")).toBeInTheDocument();
  });

  it("toggles done optimistically and persists", async () => {
    const user = userEvent.setup();
    renderWithProviders(<SprintView id="s1" />);
    await user.click(await dayHeader(3));
    const box = await screen.findByRole("checkbox", { name: /Mark Two Sum done/ });
    await user.click(box);
    await waitFor(() => expect(api.updateProblem).toHaveBeenCalledWith("c", { done_at: expect.any(String) }));
    expect(screen.getByRole("checkbox", { name: /Mark Two Sum not done/ })).toBeChecked();
  });

  it("filters by search and company from the URL", async () => {
    renderWithProviders(<SprintView id="s1" />, { searchParams: "?companies=Amazon" });
    await screen.findByText("Two Sum");
    expect(screen.getByText("Kadane's Algorithm")).toBeInTheDocument();
    expect(screen.queryByText("Largest Element")).not.toBeInTheDocument();
    expect(screen.getByText("2 matches")).toBeInTheDocument();
  });

  it("lets sprints and days collapse while filtering", async () => {
    const user = userEvent.setup();
    renderWithProviders(<SprintView id="s1" />, { searchParams: "?companies=Amazon" });
    await screen.findByText("Two Sum");

    const day = await dayHeader(3);
    await user.click(day);
    expect(day).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("Two Sum")).not.toBeInTheDocument();
    expect(screen.getByText("Kadane's Algorithm")).toBeInTheDocument();

    const sprintHeader = screen.getByRole("button", { name: /^Sprint 1(?!\d)/ });
    await user.click(sprintHeader);
    expect(sprintHeader).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("Kadane's Algorithm")).not.toBeInTheDocument();
  });

  it("shifts the backlog so the overdue day lands on today", async () => {
    const user = userEvent.setup();
    renderWithProviders(<SprintView id="s1" />);
    await user.click(await screen.findByRole("button", { name: /Shift backlog/ }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/3 problems will move/)).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Shift plan" }));
    await waitFor(() =>
      expect(api.reschedule).toHaveBeenCalledWith([
        { id: "b", day_no: 3, sprint_no: 1 },
        { id: "c", day_no: 5, sprint_no: 1 },
        { id: "d", day_no: 7, sprint_no: 1 },
      ]),
    );
    expect(screen.getByText("On track ✓")).toBeInTheDocument();
  });

  it("supports keyboard shortcuts: j to focus, x to toggle", async () => {
    const user = userEvent.setup();
    renderWithProviders(<SprintView id="s1" />);
    await screen.findByText("Largest Element");
    await user.keyboard("jj");
    await user.keyboard("x");
    await waitFor(() => expect(api.updateProblem).toHaveBeenCalledWith("b", { done_at: expect.any(String) }));
  });

  it("shows which group members completed each problem", async () => {
    const member = (user_id: string, display_name: string) => ({
      group_id: "g1", user_id, sprint_id: `s-${user_id}`, display_name, avatar: null, role: "member", joined_at: "2026-10-01T00:00:00Z",
    });
    api.listMyGroups.mockResolvedValue([{ id: "g1", name: "Prep squad", invite_code: "abc", role: "owner", sprint_id: "s1", member_count: 2 }]);
    api.getGroup.mockResolvedValue({
      group: { id: "g1", owner_id: "me", sprint_id: "s1", name: "Prep squad", invite_code: "abc", created_at: "" },
      members: [member("me", "Me"), member("e", "Eswaran")],
    });
    api.groupProgress.mockResolvedValue([{ user_id: "e", problem_key: "c", done_at: "2026-10-03T10:00:00Z" }]);

    const user = userEvent.setup();
    renderWithProviders(<SprintView id="s1" />);
    await user.click(await dayHeader(3));
    expect(await screen.findByLabelText("Completed by Eswaran")).toBeInTheDocument();
    expect(screen.getAllByLabelText(/Completed by/)).toHaveLength(1);
  });

  it("opens only the working day (next undone after the last completed) by default", async () => {
    const user = userEvent.setup();
    renderWithProviders(<SprintView id="s1" />);
    expect(await dayHeader(1)).toHaveAttribute("aria-expanded", "true");
    expect(await dayHeader(3)).toHaveAttribute("aria-expanded", "false");
    expect(await dayHeader(5)).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByText("Largest Element")).toBeInTheDocument();
    expect(screen.queryByText("Two Sum")).not.toBeInTheDocument();

    await user.click(await dayHeader(3));
    expect(screen.getByText("Two Sum")).toBeInTheDocument();
    await user.click(await dayHeader(1));
    expect(screen.queryByText("Largest Element")).not.toBeInTheDocument();
  });

  it("opens the sprint holding the working day, not an earlier sprint with a skipped problem", async () => {
    api.getSprint.mockResolvedValue({
      sprint: mkSprint({ start_date: null }),
      problems: [
        mkProblem({ id: "a", name: "Skipped One", day_no: 1, original_day_no: 1, sprint_no: 1 }),
        mkProblem({ id: "b", name: "Done Two", day_no: 8, original_day_no: 8, sprint_no: 2, done_at: "2026-10-02T10:00:00Z" }),
        mkProblem({ id: "c", name: "Next Up", day_no: 9, original_day_no: 9, sprint_no: 2 }),
      ],
    });
    renderWithProviders(<SprintView id="s1" />);
    expect(await screen.findByText("Next Up")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Sprint 1(?!\d)/ })).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByRole("button", { name: /^Sprint 2(?!\d)/ })).toHaveAttribute("aria-expanded", "true");
    expect(screen.queryByText("Done Two")).not.toBeInTheDocument();
  });

  it("expands every day while filtering", async () => {
    renderWithProviders(<SprintView id="s1" />, { searchParams: "?companies=Amazon" });
    expect(await dayHeader(3)).toHaveAttribute("aria-expanded", "true");
    expect(await dayHeader(5)).toHaveAttribute("aria-expanded", "true");
  });

  it("opens a collapsed day when keyboard focus moves into it", async () => {
    const user = userEvent.setup();
    renderWithProviders(<SprintView id="s1" />);
    await screen.findByText("Largest Element");
    await user.keyboard("jjj");
    expect(await screen.findByText("Two Sum")).toBeInTheDocument();
    expect(await dayHeader(3)).toHaveAttribute("aria-expanded", "true");
  });

  it("runs a viva before marking a theory topic done, and stars it when unsure", async () => {
    localStorage.clear();
    api.getSprint.mockResolvedValue({
      sprint,
      problems: [
        mkProblem({ id: "t", name: "Deadlocks", subject: "os", day_no: 3, original_day_no: 3 }),
        mkProblem({ id: "q", name: "Queue", subject: "dsa", day_no: 3, original_day_no: 3 }),
      ],
    });
    api.vivaQuestions.mockResolvedValue({
      mode: "viva",
      ai: true,
      viva: { questions: [{ question: "What is a deadlock?", answer: "A wait cycle." }, { question: "How to prevent it?", answer: "Lock ordering." }] },
    });
    const user = userEvent.setup();
    renderWithProviders(<SprintView id="s1" />);

    // DSA problems are marked done immediately.
    await user.click(await screen.findByRole("checkbox", { name: /Mark Queue done/ }));
    await waitFor(() => expect(api.updateProblem).toHaveBeenCalledWith("q", { done_at: expect.any(String) }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await user.click(screen.getByRole("checkbox", { name: /Mark Deadlocks done/ }));
    const dialog = await screen.findByRole("dialog");
    expect(api.updateProblem).not.toHaveBeenCalledWith("t", expect.anything());
    await user.click(within(dialog).getByRole("button", { name: "Start 2-question check" }));
    expect(await within(dialog).findByText("What is a deadlock?")).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: /Reveal/ }));
    await user.click(within(dialog).getByRole("button", { name: /Got it/ }));
    await user.click(within(dialog).getByRole("button", { name: /Reveal/ }));
    await user.click(within(dialog).getByRole("button", { name: /Not sure/ }));

    await waitFor(() => expect(api.updateProblem).toHaveBeenCalledWith("t", { done_at: expect.any(String) }));
    await waitFor(() => expect(api.updateProblem).toHaveBeenCalledWith("t", { starred: true }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("shows the Daily Recall warmup for a problem solved a week ago", async () => {
    localStorage.clear();
    api.getSprint.mockResolvedValue({
      sprint,
      problems: [
        mkProblem({ id: "old", name: "LRU Cache", day_no: 1, original_day_no: 1, done_at: subDays(new Date(), 7).toISOString(), notes: "DLL + map" }),
        mkProblem({ id: "new", name: "Two Sum", day_no: 3, original_day_no: 3 }),
      ],
    });
    api.recallQuestion.mockResolvedValue({ mode: "recall", ai: false, recall: { intro: "A week ago…", question: "Why a DLL?", hint: "h", answer: "a" } });
    renderWithProviders(<SprintView id="s1" />);
    expect(await screen.findByRole("region", { name: "Daily Recall" })).toBeInTheDocument();
    expect(await screen.findByText("Why a DLL?")).toBeInTheDocument();
    expect(api.recallQuestion).toHaveBeenCalledWith(expect.objectContaining({ name: "LRU Cache" }), "DLL + map", 7, expect.anything());
  });

  it("filters with AI from the search box and can undo", async () => {
    const user = userEvent.setup();
    api.aiFilters.mockResolvedValue({ q: "", status: "todo", companies: ["Amazon"], topics: [], subjects: [], difficulties: [] });
    renderWithProviders(<><SprintView id="s1" /><Toaster /></>);
    await screen.findByRole("heading", { name: "DSA Prep" });

    await user.click(screen.getByRole("button", { name: "Filter with AI" }));
    await user.type(screen.getByRole("textbox", { name: "Describe what you want to see" }), "amazon problems I haven't done{Enter}");

    await waitFor(() => expect(api.aiFilters).toHaveBeenCalledWith("amazon problems I haven't done", expect.objectContaining({ companies: expect.arrayContaining(["Amazon", "Google", "Zoho"]) })));
    expect(await screen.findByText("2 matches")).toBeInTheDocument();
    expect(screen.getByText("Interpreted as: Amazon · To do")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Undo" }));
    await waitFor(() => expect(screen.queryByText("2 matches")).not.toBeInTheDocument());
  });
});
