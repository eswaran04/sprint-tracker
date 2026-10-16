import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider } from "next-themes";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api", () => ({ saveAccent: vi.fn(async () => {}) }));

import { ThemePicker } from "./theme-picker";

beforeEach(() => document.documentElement.setAttribute("data-accent", "violet"));

describe("ThemePicker", () => {
  it("switches colour and mode", async () => {
    const user = userEvent.setup();
    render(<ThemeProvider attribute="class" defaultTheme="dark"><ThemePicker /></ThemeProvider>);

    expect(screen.getByRole("button", { name: "Violet" })).toHaveAttribute("aria-pressed", "true");
    await user.click(screen.getByRole("button", { name: "Pink" }));
    expect(screen.getByRole("button", { name: "Pink" })).toHaveAttribute("aria-pressed", "true");
    expect(document.documentElement.getAttribute("data-accent")).toBe("pink");

    await user.click(screen.getByRole("radio", { name: /Light/ }));
    expect(screen.getByRole("radio", { name: /Light/ })).toHaveAttribute("aria-checked", "true");
    expect(document.documentElement).toHaveClass("light");
  });
});
