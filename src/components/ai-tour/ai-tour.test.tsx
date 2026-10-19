import { fireEvent, screen, act, waitFor } from "@testing-library/react";
import { MotionConfig } from "motion/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AiTourModal } from "@/components/ai-tour/ai-tour-modal";
import {
  closeAiTour,
  hasSeenAiTour,
  openAiTour,
} from "@/lib/ai-tour-store";
import { renderWithProviders } from "@/test/render";

// Mock router
const pushMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
  usePathname: () => "/app",
}));

// Mock sprints
vi.mock("@/hooks/use-sprints", () => ({
  useSprints: () => ({ data: [{ id: "sprint-123", title: "Test Sprint" }] }),
}));

// Mock groups
vi.mock("@/hooks/use-groups", () => ({
  useMyGroups: () => ({ data: [{ id: "group-456", name: "Algo Group", sprint_id: "sprint-123" }] }),
}));

function renderTour() {
  return renderWithProviders(
    <MotionConfig transition={{ duration: 0 }}>
      <AiTourModal />
    </MotionConfig>,
  );
}

describe("AI Tour Modal", () => {
  beforeEach(() => {
    localStorage.clear();
    closeAiTour();
    pushMock.mockClear();
  });

  it("is hidden initially when not opened", () => {
    renderTour();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("renders step 1 when opened", () => {
    renderTour();
    act(() => {
      openAiTour(0);
    });

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Generate a Custom Sheet" })).toBeInTheDocument();
    expect(screen.getByText("1 / 6")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next" })).toBeInTheDocument();
  });

  it("advances through steps with the Next and Back buttons", async () => {
    renderTour();
    act(() => {
      openAiTour(0);
    });

    // Step 1 -> Next
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Ask in Plain Words" })).toBeInTheDocument();
    });
    expect(screen.getByText("2 / 6")).toBeInTheDocument();

    // Step 2 -> Back
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Generate a Custom Sheet" })).toBeInTheDocument();
    });
    expect(screen.getByText("1 / 6")).toBeInTheDocument();
  });

  it("can jump directly to a step by clicking step indicator dots", async () => {
    renderTour();
    act(() => {
      openAiTour(0);
    });

    const step3Button = screen.getByRole("button", { name: /Go to step 3/i });
    fireEvent.click(step3Button);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Smart Reschedule" })).toBeInTheDocument();
    });
    expect(screen.getByText("3 / 6")).toBeInTheDocument();
  });

  it("navigates and closes when clicking Try feature button", async () => {
    renderTour();
    act(() => {
      openAiTour(0);
    });

    const tryBtn = screen.getByRole("button", { name: /Try Generator/i });
    fireEvent.click(tryBtn);

    expect(pushMock).toHaveBeenCalledWith("/app/import");
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
    expect(hasSeenAiTour()).toBe(true);
  });

  it("closes when clicking Skip tour", async () => {
    renderTour();
    act(() => {
      openAiTour(0);
    });

    fireEvent.click(screen.getByRole("button", { name: /Skip tour/i }));
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
    expect(hasSeenAiTour()).toBe(true);
  });

  it("supports keyboard navigation: ArrowRight, ArrowLeft, Escape", async () => {
    renderTour();
    act(() => {
      openAiTour(0);
    });

    // ArrowRight -> Step 2
    fireEvent.keyDown(window, { key: "ArrowRight" });
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Ask in Plain Words" })).toBeInTheDocument();
    });

    // ArrowLeft -> Step 1
    fireEvent.keyDown(window, { key: "ArrowLeft" });
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Generate a Custom Sheet" })).toBeInTheDocument();
    });

    // Escape -> Closes
    fireEvent.keyDown(window, { key: "Escape" });
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  it("on the final step (Weekly Group Digest), button displays Finish and closes", async () => {
    renderTour();
    act(() => {
      openAiTour(5);
    });

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Weekly Group Digest" })).toBeInTheDocument();
    });
    expect(screen.getByText("6 / 6")).toBeInTheDocument();
    const finishBtn = screen.getByRole("button", { name: /Finish/i });
    expect(finishBtn).toBeInTheDocument();

    fireEvent.click(finishBtn);
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
    expect(hasSeenAiTour()).toBe(true);
  });

  it("navigates to group weekly digest when clicking action on digest step", async () => {
    renderTour();
    act(() => {
      openAiTour(5);
    });

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Weekly Group Digest" })).toBeInTheDocument();
    });

    const tryBtn = screen.getByRole("button", { name: /View Digest/i });
    fireEvent.click(tryBtn);

    expect(pushMock).toHaveBeenCalledWith("/app/groups/group-456#weekly-digest");
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
    expect(hasSeenAiTour()).toBe(true);
  });
});
