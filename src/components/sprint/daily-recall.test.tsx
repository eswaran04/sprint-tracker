import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mkProblem } from "@/test/fixtures/problems";
import { renderWithProviders } from "@/test/render";
import type { RecallCandidate } from "@/lib/recall/select";

const api = vi.hoisted(() => ({ recallQuestion: vi.fn() }));
vi.mock("@/lib/api", () => api);

import { DailyRecall } from "./daily-recall";

const TODAY = "2026-11-20";
const lru = mkProblem({ id: "lru", name: "LRU Cache", done_at: "2026-11-06T10:00:00Z", notes: "Doubly linked list + hashmap." });
const twoSum = mkProblem({ id: "two", name: "Two Sum", done_at: "2026-10-21T10:00:00Z", starred: true });
const candidates: RecallCandidate[] = [
  { problem: lru, daysAgo: 14, reason: "interval" },
  { problem: twoSum, daysAgo: 30, reason: "interval" },
];

const question = (name: string) => ({
  mode: "recall",
  ai: true,
  recall: { intro: `Two weeks ago you solved ${name}.`, question: `Why does ${name} work?`, hint: "Think.", answer: `Because of ${name}.` },
});

function setup() {
  const onStar = vi.fn();
  const onOpenNotes = vi.fn();
  renderWithProviders(<DailyRecall sprintId="s1" today={TODAY} candidates={candidates} onStar={onStar} onOpenNotes={onOpenNotes} />);
  return { onStar, onOpenNotes, user: userEvent.setup() };
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  api.recallQuestion.mockImplementation(async (p: { name: string }) => question(p.name));
});

describe("DailyRecall", () => {
  it("quizzes each problem, starring the fuzzy ones", async () => {
    const { onStar, user } = setup();
    expect(await screen.findByText("Why does LRU Cache work?")).toBeInTheDocument();
    expect(api.recallQuestion).toHaveBeenCalledWith(expect.objectContaining({ name: "LRU Cache" }), "Doubly linked list + hashmap.", 14, expect.anything());
    expect(screen.getByText("1/2")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Reveal answer/ }));
    expect(screen.getByText("Because of LRU Cache.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Fuzzy/ }));
    expect(onStar).toHaveBeenCalledWith(lru);

    expect(await screen.findByText("Why does Two Sum work?")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Reveal answer/ }));
    await user.click(screen.getByRole("button", { name: /Fuzzy/ }));
    // Already starred: not toggled off.
    expect(onStar).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/Warmup done/)).toHaveTextContent("0/2 nailed");
  });

  it("opens the user's notes", async () => {
    const { onOpenNotes, user } = setup();
    await user.click(await screen.findByRole("button", { name: /Open my notes/ }));
    expect(onOpenNotes).toHaveBeenCalledWith(lru);
  });

  it("can be skipped for the day and stays hidden", async () => {
    const { user } = setup();
    await user.click(screen.getByRole("button", { name: "Skip today" }));
    expect(screen.queryByRole("region", { name: "Daily Recall" })).not.toBeInTheDocument();
    expect(localStorage.getItem(`recall:s1:${TODAY}`)).toBe("1");
  });

  it("shows when the question came from the offline fallback", async () => {
    api.recallQuestion.mockImplementation(async (p: { name: string }) => ({ ...question(p.name), ai: false }));
    setup();
    expect(await screen.findByText("AI off · offline question")).toBeInTheDocument();
  });

  it("renders nothing without candidates", () => {
    renderWithProviders(<DailyRecall sprintId="s1" today={TODAY} candidates={[]} onStar={vi.fn()} onOpenNotes={vi.fn()} />);
    expect(screen.queryByText("Daily Recall")).not.toBeInTheDocument();
  });
});
