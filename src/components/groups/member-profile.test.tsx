import { screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SessionUserProvider } from "@/components/shell/session-user";
import { mkProblem, mkSprint } from "@/test/fixtures/problems";
import { renderWithProviders } from "@/test/render";

const api = vi.hoisted(() => ({
  getGroup: vi.fn(),
  groupProgress: vi.fn(),
  getSprint: vi.fn(),
}));
vi.mock("@/lib/api", () => api);

import { MemberProfile } from "./member-profile";

const me = { id: "me", name: "Prathis", email: "p@x.com", avatar: null, accent: null };
const withUser = (ui: React.ReactElement) => <SessionUserProvider value={me}>{ui}</SessionUserProvider>;
const member = (user_id: string, display_name: string, role: "owner" | "member" = "member") => ({
  group_id: "g1", user_id, sprint_id: `s-${user_id}`, display_name, avatar: null, role, joined_at: "2026-10-01T00:00:00Z",
});

beforeEach(() => {
  vi.clearAllMocks();
  api.getGroup.mockResolvedValue({
    group: { id: "g1", owner_id: "me", sprint_id: "s-me", name: "Prep squad", invite_code: "abc123", created_at: "" },
    members: [member("me", "Prathis", "owner"), member("e", "Eswaran"), member("k", "Kavin")],
  });
  api.groupProgress.mockResolvedValue([
    { user_id: "e", problem_key: "p1", done_at: "2026-10-02T10:00:00Z" },
    { user_id: "e", problem_key: "p2", done_at: "2026-10-03T10:00:00Z" },
    { user_id: "me", problem_key: "p1", done_at: "2026-10-03T10:00:00Z" },
  ]);
  api.getSprint.mockResolvedValue({
    sprint: mkSprint({ id: "s-me", title: "DSA Prep" }),
    problems: [
      mkProblem({ id: "p1", name: "Two Sum", done_at: "2026-10-03T10:00:00Z", notes: "my secret note" }),
      mkProblem({ id: "p2", name: "3 Sum", difficulty: "Pro" }),
      mkProblem({ id: "p3", name: "4 Sum" }),
    ],
  });
});

describe("MemberProfile", () => {
  it("shows a member's progress, rank and what they solved that you haven't", async () => {
    renderWithProviders(withUser(<MemberProfile groupId="g1" userId="e" />));
    expect(await screen.findByRole("heading", { name: "Eswaran" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Prep squad/ })).toHaveAttribute("href", "/app/groups/g1");

    expect(screen.getByText("67%")).toBeInTheDocument();
    expect(screen.getByText("2 of 3 problems")).toBeInTheDocument();
    expect(screen.getByText("#1")).toBeInTheDocument();

    const ahead = screen.getByRole("region", { name: "They solved, you haven't" });
    expect(within(ahead).getByText("3 Sum")).toBeInTheDocument();
    expect(within(ahead).queryByText("Two Sum")).not.toBeInTheDocument();

    const recent = screen.getByRole("region", { name: "Recent solves" });
    expect(within(recent).getAllByRole("listitem").map((li) => li.textContent)).toEqual([
      expect.stringContaining("3 Sum"),
      expect.stringContaining("Two Sum"),
    ]);
    expect(screen.queryByText("my secret note")).not.toBeInTheDocument();
  });

  it("skips the comparison on your own profile", async () => {
    renderWithProviders(withUser(<MemberProfile groupId="g1" userId="me" />));
    expect(await screen.findByRole("heading", { name: /Prathis/ })).toBeInTheDocument();
    expect(screen.getByText("(you)")).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "They solved, you haven't" })).not.toBeInTheDocument();
  });

  it("tells you when someone hasn't started", async () => {
    renderWithProviders(withUser(<MemberProfile groupId="g1" userId="k" />));
    expect(await screen.findByText("Kavin hasn't solved anything yet.")).toBeInTheDocument();
  });

  it("handles people who aren't in the group", async () => {
    renderWithProviders(withUser(<MemberProfile groupId="g1" userId="nobody" />));
    expect(await screen.findByText("Member not found")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Back to Prep squad/ })).toHaveAttribute("href", "/app/groups/g1");
  });

  it("handles groups you can't see", async () => {
    api.getGroup.mockResolvedValue(null);
    renderWithProviders(withUser(<MemberProfile groupId="g1" userId="e" />));
    expect(await screen.findByText("This group isn't available")).toBeInTheDocument();
  });
});
