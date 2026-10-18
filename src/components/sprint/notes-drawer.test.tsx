import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mkProblem } from "@/test/fixtures/problems";
import type { ReviewProblem, ReviewResponse } from "@/lib/review/schema";

const analyzeNote = vi.fn<(problem: ReviewProblem, notes: string, signal?: AbortSignal) => Promise<ReviewResponse>>();
const toast = vi.hoisted(() => ({ success: vi.fn(), info: vi.fn(), error: vi.fn() }));
vi.mock("@/lib/api", () => ({ analyzeNote: (...a: Parameters<typeof analyzeNote>) => analyzeNote(...a) }));
vi.mock("sonner", () => ({ toast }));

import { NotesDrawer } from "./notes-drawer";

const response = (ai: boolean, summary = "Looks solid."): ReviewResponse => ({
  ai,
  review: {
    summary,
    complexity: { time: "O(n^2)", space: "O(1)", optimal_time: "O(n)", optimal_space: "O(n)", verdict: "suboptimal", explanation: "Use a hash map." },
    edge_cases: [{ block: 1, line: 2, severity: "bug", message: "Index out of bounds." }],
    suggested_tags: ["Hash Map"],
  },
});

const CODE = "```java\nfor (int i = 0; i <= n; i++)\n  a[i]++;\n```";

function setup(notes = CODE) {
  const onSave = vi.fn(async () => {});
  const problem = mkProblem({ id: "6f1c1b7e-8a7b-4c1e-9a52-1d2f3e4a5b6c", name: "Two Sum", notes });
  render(<NotesDrawer problem={problem} onClose={() => {}} onSave={onSave} />);
  return { onSave, problem, user: userEvent.setup() };
}

beforeEach(() => vi.clearAllMocks());

describe("NotesDrawer analyze", () => {
  it("is disabled while the note is empty", () => {
    setup("");
    expect(screen.getByRole("button", { name: /analyze note/i })).toBeDisabled();
  });

  it("appends the review, shows it in preview and autosaves it", async () => {
    analyzeNote.mockResolvedValue(response(true));
    const { user, onSave, problem } = setup();

    await user.click(screen.getByRole("button", { name: /analyze note/i }));

    expect(analyzeNote).toHaveBeenCalledWith(
      { name: problem.name, url: problem.url, difficulty: problem.difficulty, subject: problem.subject, topics: problem.topics },
      CODE,
      expect.any(AbortSignal),
    );
    expect(await screen.findByRole("heading", { name: /AI Review/ })).toBeInTheDocument();
    expect(screen.getByText("Looks solid.")).toBeInTheDocument();
    expect(screen.getByText(/Index out of bounds/)).toBeInTheDocument();
    expect(screen.getByText("Hash Map")).toBeInTheDocument();
    expect(screen.queryByText(/ai-review:start/)).not.toBeInTheDocument();
    expect(toast.success).toHaveBeenCalled();

    await waitFor(() => expect(onSave).toHaveBeenCalled(), { timeout: 2000 });
    const saved = (onSave.mock.calls.at(-1) as unknown as [unknown, string])[1];
    expect(saved.startsWith(CODE)).toBe(true);
    expect(saved).toContain("<!-- ai-review:start -->");
  });

  it("replaces the previous review on re-run instead of stacking", async () => {
    analyzeNote.mockResolvedValueOnce(response(true, "First run.")).mockResolvedValueOnce(response(false, "Second run."));
    const { user } = setup();

    await user.click(screen.getByRole("button", { name: /analyze note/i }));
    await screen.findByText("First run.");
    await user.click(screen.getByRole("button", { name: /analyze note/i }));
    await screen.findByText("Second run.");

    expect(screen.queryByText("First run.")).not.toBeInTheDocument();
    expect(screen.getAllByRole("heading", { name: /AI Review/ })).toHaveLength(1);
    expect(toast.info).toHaveBeenCalledWith(expect.stringMatching(/AI unavailable/));
  });

  it("shows the server error and leaves the note untouched", async () => {
    analyzeNote.mockRejectedValue(new Error("Too many reviews, try again shortly."));
    const { user } = setup();

    await user.click(screen.getByRole("button", { name: /analyze note/i }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Too many reviews, try again shortly."));
    expect(screen.queryByRole("heading", { name: /AI Review/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /analyze note/i })).toBeEnabled();
  });
});
