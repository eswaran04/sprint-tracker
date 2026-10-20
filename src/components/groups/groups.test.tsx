import { screen, waitFor, within } from "@testing-library/react";
import { format } from "date-fns";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SessionUserProvider } from "@/components/shell/session-user";
import { mkProblem, mkSprint } from "@/test/fixtures/problems";
import { renderWithProviders } from "@/test/render";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
const api = vi.hoisted(() => ({
  getGroup: vi.fn(),
  groupProgress: vi.fn(),
  getSprint: vi.fn(),
  groupPreview: vi.fn(),
  joinGroup: vi.fn(async () => "new-sprint"),
  leaveGroup: vi.fn(),
  removeMember: vi.fn(),
  deleteGroup: vi.fn(),
  groupActivity: vi.fn(),
  groupReactions: vi.fn(),
  toggleReaction: vi.fn(),
  sendNudge: vi.fn(),
  groupDigest: vi.fn(),
}));
vi.mock("@/lib/api", () => api);

import { GroupView } from "./group-view";
import { JoinGroup } from "./join-group";

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
  api.groupActivity.mockResolvedValue([]);
  api.groupReactions.mockResolvedValue([]);
  api.groupDigest.mockResolvedValue(null);
  api.getSprint.mockResolvedValue({
    sprint: mkSprint({ id: "s-me", title: "DSA Prep" }),
    problems: [mkProblem({ id: "p1", name: "Two Sum" }), mkProblem({ id: "p2", name: "3 Sum" }), mkProblem({ id: "p3", name: "4 Sum" })],
  });
});

describe("GroupView", () => {
  it("ranks members and marks who completed each problem", async () => {
    renderWithProviders(withUser(<GroupView id="g1" />));
    expect(await screen.findByRole("heading", { name: "Prep squad" })).toBeInTheDocument();

    const ranks = within(screen.getByRole("list")).getAllByRole("listitem");
    expect(ranks.map((li) => li.textContent)).toEqual([
      expect.stringContaining("Eswaran"),
      expect.stringContaining("Prathis"),
      expect.stringContaining("Kavin"),
    ]);
    expect(within(ranks[0]).getByText("2/3")).toBeInTheDocument();
    expect(within(ranks[0]).getByRole("link", { name: /Eswaran/ })).toHaveAttribute("href", "/app/groups/g1/members/e");

    // One stacked "Completed by" cell per problem.
    const twoSum = await screen.findByLabelText("Completed by Prathis, Eswaran");
    expect(twoSum).toHaveTextContent("2/3");
    expect(screen.getByLabelText("Completed by Eswaran")).toHaveTextContent("1/3");
    expect(screen.getByLabelText("Not completed yet")).toHaveTextContent("0/3");

    // Hovering lists who did it and who hasn't yet.
    const user = userEvent.setup();
    await user.hover(twoSum);
    const list = await screen.findByText("Completed by 2 of 3");
    const popover = list.parentElement!;
    expect(within(popover).getByText("Eswaran")).toBeInTheDocument();
    expect(within(popover).getByText("(you)")).toBeInTheDocument();
    expect(within(popover).getByText("Not yet")).toBeInTheDocument();
    expect(within(popover).getByText("Kavin")).toBeInTheDocument();
    expect((screen.getByLabelText("Invite link") as HTMLInputElement).value).toContain("/app/join/abc123");
  });

  it("shows a not-available state for non-members", async () => {
    api.getGroup.mockResolvedValue(null);
    renderWithProviders(withUser(<GroupView id="g1" />));
    expect(await screen.findByText("This group isn't available")).toBeInTheDocument();
  });
});

describe("Activity feed", () => {
  const today = format(new Date(), "yyyy-MM-dd");
  const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000).toISOString();
  beforeEach(() => {
    api.groupActivity.mockResolvedValue([
      { user_id: "e", problem_name: "Two Sum", done_at: minutesAgo(5) },
      { user_id: "e", problem_name: "3 Sum", done_at: minutesAgo(1) },
      { user_id: "me", problem_name: "4 Sum", done_at: minutesAgo(2) },
    ]);
  });
  const openFeed = async () => {
    renderWithProviders(withUser(<GroupView id="g1" />));
    return await screen.findByRole("region", { name: "Activity" });
  };

  it("summarises each member's day with their latest problems", async () => {
    const feed = await openFeed();
    expect(await within(feed).findByText("solved 2 problems today")).toBeInTheDocument();
    expect(within(feed).getByText("3 Sum, Two Sum")).toBeInTheDocument();
    expect(within(feed).getByText("solved 1 problem today")).toBeInTheDocument();
  });

  it("lets you clap for others but not yourself", async () => {
    const feed = await openFeed();
    expect(await within(feed).findByRole("button", { name: "Clap for Eswaran" })).toBeInTheDocument();
    expect(within(feed).queryByRole("button", { name: "Clap for Prathis" })).not.toBeInTheDocument();
  });

  it("claps instantly and keeps the clap once saved", async () => {
    api.toggleReaction.mockImplementation(async (group: string, target: string, day: string) => {
      api.groupReactions.mockResolvedValue([{ group_id: group, target_user: target, day, reactor: "me" }]);
    });
    const feed = await openFeed();
    const btn = await within(feed).findByRole("button", { name: "Clap for Eswaran" });
    expect(btn).toHaveAttribute("aria-pressed", "false");

    await userEvent.setup().click(btn);
    expect(api.toggleReaction).toHaveBeenCalledWith("g1", "e", today);
    await waitFor(() => expect(btn).toHaveAttribute("aria-pressed", "true"));
    expect(btn).toHaveTextContent("1");
  });

  it("rolls the clap back when saving fails", async () => {
    let reject!: (e: Error) => void;
    api.toggleReaction.mockReturnValue(new Promise((_, r) => { reject = r; }));
    const feed = await openFeed();
    const btn = await within(feed).findByRole("button", { name: "Clap for Eswaran" });

    await userEvent.setup().click(btn);
    await waitFor(() => expect(btn).toHaveAttribute("aria-pressed", "true"));
    reject(new Error("nope"));
    await waitFor(() => expect(btn).toHaveAttribute("aria-pressed", "false"));
  });
});

describe("Nudges", () => {
  beforeEach(() => {
    // Eswaran has solved today; Kavin hasn't started.
    api.groupProgress.mockResolvedValue([{ user_id: "e", problem_key: "p1", done_at: new Date().toISOString() }]);
  });

  it("offers a nudge only to other members who haven't solved today", async () => {
    renderWithProviders(withUser(<GroupView id="g1" />));
    expect(await screen.findByRole("button", { name: "Nudge Kavin" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Nudge Eswaran" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Nudge Prathis" })).not.toBeInTheDocument();
  });

  it("sends a nudge once and then shows it as sent", async () => {
    api.sendNudge.mockResolvedValue(undefined);
    renderWithProviders(withUser(<GroupView id="g1" />));
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Nudge Kavin" }));
    await user.click(await screen.findByRole("button", { name: "Send without message" }));

    expect(api.sendNudge).toHaveBeenCalledWith("g1", "k", null);
    expect(await screen.findByRole("button", { name: "Nudged Kavin" })).toBeDisabled();
  });

  it("sends a typed message, or a suggested one", async () => {
    api.sendNudge.mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderWithProviders(withUser(<GroupView id="g1" />));
    await user.click(await screen.findByRole("button", { name: "Nudge Kavin" }));

    const send = screen.getByRole("button", { name: "Send" });
    expect(send).toBeDisabled();
    const box = screen.getByRole("textbox", { name: "Message for Kavin" });
    await user.type(box, "  LRU tonight?  ");
    expect(screen.getByText("12/140")).toBeInTheDocument();
    await user.click(send);
    expect(api.sendNudge).toHaveBeenCalledWith("g1", "k", "LRU tonight?");
  });

  it("blocks messages over 140 characters", async () => {
    const user = userEvent.setup();
    renderWithProviders(withUser(<GroupView id="g1" />));
    await user.click(await screen.findByRole("button", { name: "Nudge Kavin" }));
    const box = screen.getByRole("textbox", { name: "Message for Kavin" });
    await user.click(box);
    await user.paste("x".repeat(141));
    expect(screen.getByText("141/140")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send" })).toBeDisabled();
  });

  it("fills the box from a suggestion chip", async () => {
    const user = userEvent.setup();
    renderWithProviders(withUser(<GroupView id="g1" />));
    await user.click(await screen.findByRole("button", { name: "Nudge Kavin" }));
    const chips = within(screen.getByLabelText("Suggested messages")).getAllByRole("button");
    expect(chips.length).toBeGreaterThan(0);
    await user.click(chips[0]);
    expect(screen.getByRole("textbox", { name: "Message for Kavin" })).toHaveValue(chips[0].textContent);
  });

  it("keeps the button available when the nudge fails", async () => {
    api.sendNudge.mockRejectedValue(new Error("You already nudged them today"));
    const user = userEvent.setup();
    renderWithProviders(withUser(<GroupView id="g1" />));
    await user.click(await screen.findByRole("button", { name: "Nudge Kavin" }));
    await user.click(await screen.findByRole("button", { name: "Send without message" }));

    await waitFor(() => expect(api.sendNudge).toHaveBeenCalled());
    expect(screen.getByRole("button", { name: "Nudge Kavin" })).toBeEnabled();
  });
});

describe("Weekly digest", () => {
  const digest = {
    headline: "Eswaran cleared Sprint 1!",
    lines: ["Eswaran led the week with 2 solves.", "You have 1 problem behind plan."],
    pairUp: [{ partner: { userId: "e", name: "Eswaran" }, problem: { key: "p2", name: "3 Sum", url: "https://x.test/3sum", difficulty: "Core" }, dueForMe: true }],
    weekSolves: 2,
    ai: true,
  };

  it("shows the AI digest above the leaderboard with pair-ups", async () => {
    api.groupDigest.mockResolvedValue(digest);
    renderWithProviders(withUser(<GroupView id="g1" />));
    const card = await screen.findByRole("region", { name: "Weekly digest" });
    expect(within(card).getByRole("heading", { name: "Eswaran cleared Sprint 1!" })).toBeInTheDocument();
    expect(within(card).getByText("AI")).toBeInTheDocument();
    expect(within(card).getByText("You have 1 problem behind plan.")).toBeInTheDocument();
    expect(within(card).getByRole("link", { name: "3 Sum" })).toHaveAttribute("href", "https://x.test/3sum");
    expect(api.groupDigest).toHaveBeenCalledWith("g1", format(new Date(), "yyyy-MM-dd"));
    // Eswaran solved today, so the leaderboard hides his bell, but the pair-up still offers a nudge.
    expect(within(card).getByRole("button", { name: "Nudge Eswaran about 3 Sum" })).toBeInTheDocument();
  });

  it("nudges a pair-up partner with a message, then shows them as nudged", async () => {
    api.groupDigest.mockResolvedValue(digest);
    api.sendNudge.mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderWithProviders(withUser(<GroupView id="g1" />));
    const card = await screen.findByRole("region", { name: "Weekly digest" });
    await user.click(within(card).getByRole("button", { name: "Nudge Eswaran about 3 Sum" }));
    const chip = within(screen.getByLabelText("Suggested messages")).getAllByRole("button")[0];
    expect(chip).toHaveTextContent("3 Sum");
    await user.click(chip);
    await user.click(screen.getByRole("button", { name: "Send" }));

    expect(api.sendNudge).toHaveBeenCalledWith("g1", "e", chip.textContent);
    expect(await within(card).findByText("Nudged")).toBeInTheDocument();
  });

  it("hides the AI badge for template digests and the card when empty", async () => {
    api.groupDigest.mockResolvedValue({ ...digest, ai: false, pairUp: [] });
    const { unmount } = renderWithProviders(withUser(<GroupView id="g1" />));
    const card = await screen.findByRole("region", { name: "Weekly digest" });
    expect(within(card).queryByText("AI")).not.toBeInTheDocument();
    unmount();

    api.groupDigest.mockResolvedValue(null);
    renderWithProviders(withUser(<GroupView id="g1" />));
    expect(await screen.findByRole("heading", { name: "Prep squad" })).toBeInTheDocument();
    await waitFor(() => expect(api.groupDigest).toHaveBeenCalledTimes(2));
    expect(screen.queryByRole("region", { name: "Weekly digest" })).not.toBeInTheDocument();
  });
});

describe("Confirmations", () => {
  it("asks before removing a member, then removes them", async () => {
    api.removeMember.mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderWithProviders(withUser(<GroupView id="g1" />));
    await user.click(await screen.findByRole("button", { name: "Remove Kavin" }));

    const dialog = await screen.findByRole("dialog", { name: "Remove Kavin?" });
    expect(api.removeMember).not.toHaveBeenCalled();
    await user.click(within(dialog).getByRole("button", { name: "Remove" }));

    expect(api.removeMember).toHaveBeenCalledWith("g1", "k");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("does nothing when the removal is cancelled", async () => {
    const user = userEvent.setup();
    renderWithProviders(withUser(<GroupView id="g1" />));
    await user.click(await screen.findByRole("button", { name: "Remove Kavin" }));
    await user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Cancel" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(api.removeMember).not.toHaveBeenCalled();
  });

  it("asks before deleting the group", async () => {
    api.deleteGroup.mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderWithProviders(withUser(<GroupView id="g1" />));
    await user.click(await screen.findByRole("button", { name: "Delete group" }));
    await user.click(within(await screen.findByRole("dialog", { name: "Delete this group?" })).getByRole("button", { name: "Delete group" }));

    expect(api.deleteGroup).toHaveBeenCalledWith("g1");
    await waitFor(() => expect(push).toHaveBeenCalledWith("/app/s/s-me"));
  });

  it("asks before leaving the group", async () => {
    api.getGroup.mockResolvedValue({
      group: { id: "g1", owner_id: "e", sprint_id: "s-e", name: "Prep squad", invite_code: "abc123", created_at: "" },
      members: [member("me", "Prathis"), member("e", "Eswaran", "owner")],
    });
    api.leaveGroup.mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderWithProviders(withUser(<GroupView id="g1" />));
    await user.click(await screen.findByRole("button", { name: "Leave" }));
    await user.click(within(await screen.findByRole("dialog", { name: "Leave this group?" })).getByRole("button", { name: "Leave" }));

    expect(api.leaveGroup).toHaveBeenCalledWith("g1");
  });
});

describe("JoinGroup", () => {
  const preview = {
    id: "g1", name: "Prep squad", owner_name: "Prathis", member_count: 2, sheet_title: "DSA Prep",
    problem_count: 600, day_count: 136, my_sprint_id: null, existing_copy_id: null,
  };

  it("joins with a fresh copy and opens the new sprint", async () => {
    api.groupPreview.mockResolvedValue(preview);
    const user = userEvent.setup();
    renderWithProviders(withUser(<JoinGroup code="abc123" />));
    expect(await screen.findByRole("heading", { name: "Prep squad" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Join group" }));
    await waitFor(() => expect(api.joinGroup).toHaveBeenCalledWith("abc123", { name: "Prathis", avatar: null }, undefined));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/app/s/new-sprint"));
  });

  it("offers to link an existing copy", async () => {
    api.groupPreview.mockResolvedValue({ ...preview, existing_copy_id: "copy-1" });
    const user = userEvent.setup();
    renderWithProviders(withUser(<JoinGroup code="abc123" />));
    await user.click(await screen.findByRole("button", { name: /Join with my existing copy/ }));
    await waitFor(() => expect(api.joinGroup).toHaveBeenCalledWith("abc123", { name: "Prathis", avatar: null }, "copy-1"));
  });

  it("links members straight to the group", async () => {
    api.groupPreview.mockResolvedValue({ ...preview, my_sprint_id: "s-me" });
    renderWithProviders(withUser(<JoinGroup code="abc123" />));
    expect(await screen.findByRole("link", { name: "Open group" })).toHaveAttribute("href", "/app/groups/g1");
  });

  it("handles invalid links", async () => {
    api.groupPreview.mockResolvedValue(null);
    renderWithProviders(withUser(<JoinGroup code="nope" />));
    expect(await screen.findByText("This invite link isn't valid")).toBeInTheDocument();
  });
});
