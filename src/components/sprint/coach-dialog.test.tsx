import { act, renderHook, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import type { CoachPlan } from "@/lib/api";
import type { Problem } from "@/lib/types";
import { mkProblem, mkSprint } from "@/test/fixtures/problems";
import { renderWithProviders } from "@/test/render";

const api = vi.hoisted(() => ({ reschedule: vi.fn(async () => {}), coachPlan: vi.fn(), updateProblem: vi.fn(), updateSprint: vi.fn() }));
vi.mock("@/lib/api", () => api);
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { toast } from "sonner";
import { STALE_PLAN_MESSAGE, useCoach } from "@/hooks/use-coach";
import { sprintKey } from "@/hooks/use-sprint";
import { CoachDialog } from "./coach-dialog";

const problems: Problem[] = [
  mkProblem({ id: "a", name: "Coin Change", day_no: 1, difficulty: "Pro" }),
  mkProblem({ id: "b", name: "Climbing Stairs", day_no: 2, difficulty: "Basic" }),
];

const plan: CoachPlan = {
  changes: [
    { id: "a", day_no: 4, sprint_no: 1 },
    { id: "b", day_no: 5, sprint_no: 1 },
  ],
  summary: { moved: 2, daysAdded: 3, reviewDays: [3], oldEnd: 2, newEnd: 5, label: "2 problems move, 3 days added", from: { a: 1, b: 2 } },
  rationale: ["Pro problems run late for you, so one a day."],
  strategy: { dailyCapacity: 3, maxProPerDay: 1, reviewBefore: [], frontLoadFlagged: false },
  aiUsed: false,
  plainShift: { moved: 2, newEnd: 4 },
};

function Harness({ initial, onApprove }: { initial: Problem[]; onApprove: (p: CoachPlan) => void }) {
  const [ps] = useState(initial);
  return (
    <CoachDialog
      open onOpenChange={() => {}} plan={plan} isPending={false} applying={false}
      problems={ps} dateFor={() => null} onRegenerate={() => {}} onApprove={onApprove}
    />
  );
}

describe("CoachDialog", () => {
  it("shows the summary, rule-based badge, rationale and per-day diff", () => {
    renderWithProviders(<Harness initial={problems} onApprove={() => {}} />);
    expect(screen.getByText("2 problems move, 3 days added")).toBeInTheDocument();
    expect(screen.getByText("Rule-based plan")).toBeInTheDocument();
    expect(screen.getByText(/Pro problems run late/)).toBeInTheDocument();
    expect(screen.getByText("📖 Review day")).toBeInTheDocument();
    expect(screen.getByText("Coin Change")).toBeInTheDocument();
    expect(screen.getByText(/Plain shift would move 2 problems and end on Day 4; this plan ends on Day 5/)).toBeInTheDocument();
  });

  it("Approve hands over exactly the plan", async () => {
    const onApprove = vi.fn();
    renderWithProviders(<Harness initial={problems} onApprove={onApprove} />);
    await userEvent.setup().click(screen.getByRole("button", { name: "Approve" }));
    expect(onApprove).toHaveBeenCalledWith(plan);
  });

  it("blocks Approve when the plan is stale", () => {
    const moved = [{ ...problems[0], day_no: 3 }, problems[1]];
    renderWithProviders(<Harness initial={moved} onApprove={() => {}} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Plan is out of date");
    expect(screen.getByRole("button", { name: "Approve" })).toBeDisabled();
  });
});

describe("useCoach.approve", () => {
  const setup = (cached: Problem[]) => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    qc.setQueryData(sprintKey("s1"), { sprint: mkSprint(), problems: cached });
    const wrapper = ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
    return { qc, ...renderHook(() => useCoach("s1"), { wrapper }) };
  };

  it("calls reschedule with exactly plan.changes and applies them optimistically", async () => {
    const { result, qc } = setup(structuredClone(problems));
    let ok = false;
    await act(async () => {
      ok = await result.current.approve(plan);
    });
    expect(ok).toBe(true);
    expect(api.reschedule).toHaveBeenCalledWith(plan.changes);
    const cached = qc.getQueryData<{ problems: Problem[] }>(sprintKey("s1"))!;
    expect(cached.problems.map((p) => p.day_no)).toEqual([4, 5]);
    expect(toast.success).toHaveBeenCalledWith("2 problems move, 3 days added", expect.anything());
  });

  it("refuses a stale plan (a problem was finished since)", async () => {
    api.reschedule.mockClear();
    const { result } = setup([{ ...problems[0], done_at: "2026-10-01T00:00:00Z" }, problems[1]]);
    let ok = true;
    await act(async () => {
      ok = await result.current.approve(plan);
    });
    expect(ok).toBe(false);
    expect(api.reschedule).not.toHaveBeenCalled();
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(STALE_PLAN_MESSAGE));
  });
});
