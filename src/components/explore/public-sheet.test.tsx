import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mkSheet } from "@/test/fixtures/sheets";
import { renderWithProviders } from "@/test/render";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
const api = vi.hoisted(() => ({
  getPublicSheet: vi.fn(),
  copyPublicSheet: vi.fn(async () => "copy-1"),
  listSprints: vi.fn(async () => [] as { id: string; copied_from: string | null }[]),
  updateSprint: vi.fn(async () => {}),
  similarSheets: vi.fn(async () => [] as ReturnType<typeof mkSheet>[]),
}));
vi.mock("@/lib/api", () => api);

import { PublicSheetView } from "./public-sheet";

const problems = [
  { id: "a", sprint_id: "pub1", position: 0, name: "Two Sum", url: "https://x/two-sum", subject: "dsa", difficulty: "Basic", companies: ["Google"], topics: ["Hashing"], sprint_no: 1, day_no: 1 },
  { id: "b", sprint_id: "pub1", position: 1, name: "LRU Cache", url: "", subject: "dsa", difficulty: "Pro", companies: ["Amazon"], topics: ["Design"], sprint_no: 1, day_no: 2 },
];

beforeEach(() => {
  vi.clearAllMocks();
  api.getPublicSheet.mockResolvedValue({ sheet: mkSheet(), problems });
  api.listSprints.mockResolvedValue([]);
  api.similarSheets.mockResolvedValue([]);
});

describe("PublicSheetView", () => {
  it("shows the catalogue and copies the sheet", async () => {
    const user = userEvent.setup();
    renderWithProviders(<PublicSheetView id="pub1" />);
    expect(await screen.findByRole("heading", { name: "DSA Prep Sheet" })).toBeInTheDocument();
    expect(screen.getByText("Two Sum")).toBeInTheDocument();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();

    await user.click(await screen.findByRole("button", { name: /Use this sheet/ }));
    await waitFor(() => expect(api.copyPublicSheet).toHaveBeenCalledWith("pub1"));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/app/s/copy-1"));
  });

  it("links the owner to their own sprint", async () => {
    api.listSprints.mockResolvedValue([{ id: "pub1", copied_from: null }]);
    renderWithProviders(<PublicSheetView id="pub1" />);
    expect(await screen.findByRole("link", { name: "Open your sprint" })).toHaveAttribute("href", "/app/s/pub1");
  });

  it("links to an existing copy instead of copying again", async () => {
    api.listSprints.mockResolvedValue([{ id: "mine", copied_from: "pub1" }]);
    renderWithProviders(<PublicSheetView id="pub1" />);
    expect(await screen.findByRole("link", { name: "Open your copy" })).toHaveAttribute("href", "/app/s/mine");
  });

  it("filters the catalogue by company", async () => {
    const user = userEvent.setup();
    renderWithProviders(<PublicSheetView id="pub1" />);
    await screen.findByText("Two Sum");
    await user.click(screen.getByRole("button", { name: /Company/ }));
    await user.click(await screen.findByRole("option", { name: /Amazon/ }));
    await waitFor(() => expect(screen.queryByText("Two Sum")).not.toBeInTheDocument());
    expect(screen.getByText("LRU Cache")).toBeInTheDocument();
  });

  it("shows a not-available state for private sheets", async () => {
    api.getPublicSheet.mockResolvedValue(null);
    renderWithProviders(<PublicSheetView id="pub1" />);
    expect(await screen.findByText("This sheet isn't available")).toBeInTheDocument();
  });

  it("lets only the owner rename the sheet", async () => {
    const user = userEvent.setup();
    api.listSprints.mockResolvedValue([{ id: "pub1", copied_from: null }]);
    renderWithProviders(<PublicSheetView id="pub1" />);
    await user.click(await screen.findByRole("button", { name: "Edit sheet name" }));
    const name = screen.getByLabelText("Name");
    await user.clear(name);
    await user.type(name, "Blind 75+");
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(api.updateSprint).toHaveBeenCalledWith("pub1", { title: "Blind 75+", description: "Arrays to DP in 20 sprints" }),
    );
  });

  it("shows similar sheets when there are any", async () => {
    api.similarSheets.mockResolvedValue([mkSheet({ id: "sim1", title: "Graph Mastery" })]);
    renderWithProviders(<PublicSheetView id="pub1" />);
    expect(await screen.findByRole("heading", { name: "Sheets like this one" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Graph Mastery/ })).toHaveAttribute("href", "/app/sheets/sim1");
    expect(api.similarSheets).toHaveBeenCalledWith("pub1", 3);
  });

  it("hides the similar section when there are no neighbours", async () => {
    renderWithProviders(<PublicSheetView id="pub1" />);
    await screen.findByText("Two Sum");
    await waitFor(() => expect(api.similarSheets).toHaveBeenCalled());
    expect(screen.queryByRole("heading", { name: "Sheets like this one" })).not.toBeInTheDocument();
  });

  it("hides the edit control from non-owners", async () => {
    renderWithProviders(<PublicSheetView id="pub1" />);
    await screen.findByRole("heading", { name: "DSA Prep Sheet" });
    expect(screen.queryByRole("button", { name: "Edit sheet name" })).not.toBeInTheDocument();
  });
});
