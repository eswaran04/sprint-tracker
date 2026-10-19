import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/render";

const api = vi.hoisted(() => ({ myNudges: vi.fn(), markNudgesSeen: vi.fn() }));
vi.mock("@/lib/api", () => api);

import { NudgeInbox } from "./nudge-inbox";

const nudge = (id: string, sender_name: string) => ({
  id, group_id: "g1", group_name: "Prep squad", sender_name, created_at: new Date().toISOString(), message: null as string | null,
});

beforeEach(() => {
  vi.clearAllMocks();
  api.markNudgesSeen.mockResolvedValue(undefined);
});

describe("NudgeInbox", () => {
  it("shows how many new nudges you have", async () => {
    api.myNudges.mockResolvedValue([nudge("1", "Eswaran"), nudge("2", "Kavin")]);
    renderWithProviders(<NudgeInbox />);
    expect(await screen.findByRole("button", { name: "2 new nudges" })).toHaveTextContent("2");
  });

  it("lists who nudged you, links to the group and marks them seen", async () => {
    api.myNudges.mockResolvedValue([nudge("1", "Eswaran")]);
    renderWithProviders(<NudgeInbox />);
    await userEvent.setup().click(await screen.findByRole("button", { name: "1 new nudge" }));

    const link = await screen.findByRole("link", { name: /Eswaran nudged you in Prep squad/ });
    expect(link).toHaveAttribute("href", "/app/groups/g1");
    await waitFor(() => expect(api.markNudgesSeen).toHaveBeenCalledTimes(1));
  });

  it("shows the sender's message as plain quoted text", async () => {
    api.myNudges.mockResolvedValue([
      { ...nudge("1", "Eswaran"), message: "<b>LRU</b> tonight?" },
      { ...nudge("2", "Kavin"), message: null },
    ]);
    renderWithProviders(<NudgeInbox />);
    await userEvent.setup().click(await screen.findByRole("button", { name: "2 new nudges" }));

    const quote = await screen.findByText("<b>LRU</b> tonight?");
    expect(quote.tagName).toBe("Q");
    expect(document.querySelector("b")).toBeNull();
    expect(screen.getAllByRole("link")[1].querySelector("q")).toBeNull();
  });

  it("says so when there is nothing new, without marking anything", async () => {
    api.myNudges.mockResolvedValue([]);
    renderWithProviders(<NudgeInbox />);
    await userEvent.setup().click(await screen.findByRole("button", { name: "Nudges" }));

    expect(await screen.findByText("No new nudges")).toBeInTheDocument();
    expect(api.markNudgesSeen).not.toHaveBeenCalled();
    expect(within(document.body).queryByRole("link")).not.toBeInTheDocument();
  });
});
