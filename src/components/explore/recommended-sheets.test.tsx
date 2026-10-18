import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mkSheet } from "@/test/fixtures/sheets";
import { renderWithProviders } from "@/test/render";

const api = vi.hoisted(() => ({
  getGoal: vi.fn(),
  saveGoal: vi.fn(),
  recommendedSheets: vi.fn(),
}));
vi.mock("@/lib/api", () => api);

import { RecommendedSheets } from "./recommended-sheets";

beforeEach(() => {
  vi.clearAllMocks();
  api.recommendedSheets.mockResolvedValue([mkSheet({ id: "r1", title: "DP Deep Dive" })]);
  api.saveGoal.mockImplementation(async (g: string) => g.trim() || null);
});

describe("RecommendedSheets", () => {
  it("renders nothing when AI is turned off", async () => {
    api.getGoal.mockResolvedValue({ goal: null, enabled: false });
    const { container } = renderWithProviders(<RecommendedSheets />);
    await waitFor(() => expect(api.getGoal).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it("asks for a goal, saves it, then shows recommendations", async () => {
    const user = userEvent.setup();
    api.getGoal.mockResolvedValue({ goal: null, enabled: true });
    renderWithProviders(<RecommendedSheets />);
    await user.type(await screen.findByLabelText("Your study goal"), "FAANG SDE2, weak at DP");
    expect(api.recommendedSheets).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Save goal" }));
    await waitFor(() => expect(api.saveGoal).toHaveBeenCalledWith("FAANG SDE2, weak at DP"));
    expect(await screen.findByRole("heading", { name: "Recommended for your goal" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /DP Deep Dive/ })).toHaveAttribute("href", "/app/sheets/r1");
  });

  it("shows an empty message and can clear the goal", async () => {
    const user = userEvent.setup();
    api.getGoal.mockResolvedValue({ goal: "System design", enabled: true });
    api.recommendedSheets.mockResolvedValue([]);
    renderWithProviders(<RecommendedSheets />);
    expect(await screen.findByText(/No matching sheets yet/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Clear goal" }));
    await waitFor(() => expect(api.saveGoal).toHaveBeenCalledWith(""));
    expect(await screen.findByLabelText("Your study goal")).toBeInTheDocument();
  });
});
