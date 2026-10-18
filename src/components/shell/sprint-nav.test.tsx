import { fireEvent, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SprintNav } from "@/components/shell/sprint-nav";
import { openAiTour } from "@/lib/ai-tour-store";
import { renderWithProviders } from "@/test/render";

// Mock router / pathname
vi.mock("next/navigation", () => ({
  usePathname: () => "/app/s/sprint-1",
  useRouter: () => ({ push: vi.fn() }),
}));

// Mock sprints & groups
vi.mock("@/hooks/use-sprints", () => ({
  useSprints: () => ({
    data: [{ id: "sprint-1", title: "Blind 75", done: 10, total: 75 }],
    isLoading: false,
  }),
}));

vi.mock("@/hooks/use-groups", () => ({
  useMyGroups: () => ({
    data: [{ id: "group-1", name: "Meta Squad", member_count: 5, sprint_id: "sprint-1" }],
  }),
}));

vi.mock("@/lib/ai-tour-store", () => ({
  openAiTour: vi.fn(),
}));

describe("SprintNav AI Tools", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it("renders new AI tools initially when none have been seen/clicked", () => {
    renderWithProviders(<SprintNav />);

    expect(screen.getByText("AI tools")).toBeInTheDocument();
    expect(screen.getByText("Generate a sheet")).toBeInTheDocument();
    expect(screen.getByText("Ask in plain words")).toBeInTheDocument();
    expect(screen.getByText("Smart reschedule")).toBeInTheDocument();
    expect(screen.getByText("5-min warmup")).toBeInTheDocument();
    expect(screen.getByText("Code & intuition review")).toBeInTheDocument();
    expect(screen.getByText("Readiness report")).toBeInTheDocument();
    expect(screen.getByText("Group weekly digest")).toBeInTheDocument();
  });

  it("hides an AI tool once clicked into, while others remain visible", async () => {
    renderWithProviders(<SprintNav />);

    // Click "Ask in plain words"
    const searchLink = screen.getByText("Ask in plain words");
    fireEvent.click(searchLink);

    // It should now be marked seen in localStorage and hidden
    expect(localStorage.getItem("aibc:feature-seen:ai-search")).toBe("1");
    expect(screen.queryByText("Ask in plain words")).not.toBeInTheDocument();

    // Other unseen tools remain visible
    expect(screen.getByText("Generate a sheet")).toBeInTheDocument();
    expect(screen.getByText("Smart reschedule")).toBeInTheDocument();
  });

  it("hides all AI tools when they have been seen, leaving the clean header and Tour button", () => {
    // Mark all as seen
    localStorage.setItem("aibc:feature-seen:sheet-generator", "1");
    localStorage.setItem("aibc:feature-seen:ai-search", "1");
    localStorage.setItem("aibc:feature-seen:smart-reschedule", "1");
    localStorage.setItem("aibc:feature-seen:daily-warmup", "1");
    localStorage.setItem("aibc:feature-seen:code-review", "1");
    localStorage.setItem("aibc:feature-seen:readiness-report", "1");
    localStorage.setItem("aibc:feature-seen:group-digest", "1");

    renderWithProviders(<SprintNav />);

    // Header and Tour button stay
    expect(screen.getByText("AI tools")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Take AI features tour/i })).toBeInTheDocument();

    // The individual links are hidden
    expect(screen.queryByText("Generate a sheet")).not.toBeInTheDocument();
    expect(screen.queryByText("Ask in plain words")).not.toBeInTheDocument();
    expect(screen.queryByText("Smart reschedule")).not.toBeInTheDocument();
    expect(screen.queryByText("5-min warmup")).not.toBeInTheDocument();
    expect(screen.queryByText("Code & intuition review")).not.toBeInTheDocument();
    expect(screen.queryByText("Readiness report")).not.toBeInTheDocument();
    expect(screen.queryByText("Group weekly digest")).not.toBeInTheDocument();
  });

  it("allows toggling 'All' to expand seen tools and 'Less' to collapse them", () => {
    localStorage.setItem("aibc:feature-seen:sheet-generator", "1");
    localStorage.setItem("aibc:feature-seen:ai-search", "1");

    renderWithProviders(<SprintNav />);

    // Click "All" button
    const allButton = screen.getByRole("button", { name: /Show all AI tools/i });
    fireEvent.click(allButton);

    // Seen tools are now visible
    expect(screen.getByText("Generate a sheet")).toBeInTheDocument();
    expect(screen.getByText("Ask in plain words")).toBeInTheDocument();

    // Click "Less" button
    const lessButton = screen.getByRole("button", { name: /Hide clicked AI tools/i });
    fireEvent.click(lessButton);

    // Seen tools are hidden again
    expect(screen.queryByText("Generate a sheet")).not.toBeInTheDocument();
    expect(screen.queryByText("Ask in plain words")).not.toBeInTheDocument();
  });

  it("clicking Tour opens the AI tour at step 0", () => {
    renderWithProviders(<SprintNav />);

    const tourBtn = screen.getByRole("button", { name: /Take AI features tour/i });
    fireEvent.click(tourBtn);

    expect(openAiTour).toHaveBeenCalledWith(0);
  });
});
