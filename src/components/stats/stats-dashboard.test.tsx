import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { mkProblem, mkSprint } from "@/test/fixtures/problems";
import { renderWithProviders } from "@/test/render";

const api = vi.hoisted(() => ({ getSprint: vi.fn(), getMyShareReport: vi.fn(), generateShareReport: vi.fn(), stopSharing: vi.fn() }));
vi.mock("@/lib/api", () => api);

import { StatsDashboard } from "./stats-dashboard";

describe("StatsDashboard", () => {
  it("shows month calendars for the selected year and capitalized subjects", async () => {
    const thisYear = new Date().getFullYear();
    api.getSprint.mockResolvedValue({
      sprint: mkSprint({ start_date: `${thisYear - 1}-12-01` }),
      problems: [
        mkProblem({ subject: "dsa", done_at: new Date().toISOString() }),
        mkProblem({ subject: "computer-networks" }),
      ],
    });
    renderWithProviders(<StatsDashboard id="s1" />);

    expect(await screen.findByText(`solved in ${thisYear}`)).toBeInTheDocument();
    const header = screen.getByText(`solved in ${thisYear}`).parentElement!;
    expect(within(header).getByText("1")).toBeInTheDocument();
    expect(screen.getByText(/Total active days:/)).toHaveTextContent("Total active days: 1");
    expect(screen.getByText(/Max streak:/)).toHaveTextContent("Max streak: 1");
    expect(screen.getByRole("combobox", { name: "Year" })).toHaveTextContent(String(thisYear));
    expect(screen.getAllByText("Jan")).not.toHaveLength(0);
    // Every day of the year gets a cell (future included), and today isn't outlined.
    expect(document.body.querySelector(`[data-date="${thisYear}-12-31"]`)).not.toBeNull();
    expect(document.body.querySelectorAll("[data-date]").length).toBeGreaterThanOrEqual(365);
    expect(document.body.querySelector("[data-date].ring-1")).toBeNull();
    expect(screen.getByText("DSA")).toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(screen.getByRole("combobox", { name: "Year" }));
    await user.click(await screen.findByRole("option", { name: String(thisYear - 1) }));
    expect(await screen.findByText(`solved in ${thisYear - 1}`)).toBeInTheDocument();
    expect(screen.getByText(/Total active days:/)).toHaveTextContent("Total active days: 0");
    expect(screen.getByText("Computer Networks")).toBeInTheDocument();
  });

  it("generates a shareable readiness report", async () => {
    api.getSprint.mockResolvedValue({ sprint: mkSprint({ title: "Google Prep" }), problems: [mkProblem({})] });
    api.getMyShareReport.mockResolvedValue(null);
    api.generateShareReport.mockResolvedValue({
      slug: "google-prep-abc123",
      sprint_id: "s1",
      title: "Google Prep",
      readiness: [{ company: "Google", score: 82, done: 8, total: 10, confidence: "high" }],
      scout: { line1: "Battle-tested in Trees.", line2: "Vulnerable in Backtracking.", strengths: ["Trees"], weaknesses: ["Backtracking"], ai: true },
      stats: { pct: 80, done: 8, total: 10, streak: 3, longest: 5, pro_done: 1, pro_total: 2 },
      updated_at: "2026-10-12T00:00:00.000Z",
    });
    renderWithProviders(<StatsDashboard id="s1" />);

    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: /Generate Readiness Report/ }));
    expect(await screen.findByTestId("share-link")).toHaveTextContent("/share/google-prep-abc123");
    expect(api.generateShareReport).toHaveBeenCalledWith("s1");
    expect(screen.getByRole("img", { name: /readiness report/ })).toHaveAttribute("src", expect.stringContaining("/api/og/sprint/s1?v="));
    expect(screen.getByRole("link", { name: /Post on X/ })).toHaveAttribute("href", expect.stringContaining("82%25%20Ready%20for%20Google"));
    expect(screen.getByText("AI")).toBeInTheDocument();
  });

  it("shows an existing report without regenerating", async () => {
    api.generateShareReport.mockClear();
    api.getSprint.mockResolvedValue({ sprint: mkSprint(), problems: [mkProblem({})] });
    api.getMyShareReport.mockResolvedValue({
      slug: "dsa-prep-zzz999", sprint_id: "s1", title: "DSA Prep", readiness: [],
      scout: { line1: "a", line2: "b", strengths: [], weaknesses: [], ai: false },
      stats: { pct: 0, done: 0, total: 1, streak: 0, longest: 0, pro_done: 0, pro_total: 0 },
      updated_at: "2026-10-12T00:00:00.000Z",
    });
    renderWithProviders(<StatsDashboard id="s1" />);
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: /Generate Readiness Report/ }));
    expect(await screen.findByTestId("share-link")).toHaveTextContent("/share/dsa-prep-zzz999");
    expect(screen.getByText("Built-in")).toBeInTheDocument();
    expect(api.generateShareReport).not.toHaveBeenCalled();
  });
});
