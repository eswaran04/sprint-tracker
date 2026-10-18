import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const fb = vi.hoisted(() => ({
  getRedirectResult: vi.fn(),
  signInWithPopup: vi.fn(),
  signInWithRedirect: vi.fn(),
  signOut: vi.fn(async () => {}),
}));
vi.mock("firebase/auth", () => ({ ...fb, GoogleAuthProvider: class {} }));
vi.mock("@/lib/firebase/client", () => ({ firebaseAuth: () => ({}) }));
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams("next=/app/groups") }));
vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));

const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148";
const DESKTOP = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/138.0 Safari/537.36";

const assign = vi.fn();
const user = { getIdToken: async () => "id-token" };

async function load() {
  vi.resetModules(); // fresh per-page-load redirect state
  return (await import("./google-sign-in")).GoogleSignIn;
}

beforeEach(() => {
  sessionStorage.clear();
  vi.stubGlobal("location", { ...window.location, assign });
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ data: null }), { status: 200 })));
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

function setUserAgent(ua: string) {
  vi.spyOn(navigator, "userAgent", "get").mockReturnValue(ua);
}

describe("GoogleSignIn", () => {
  it("uses the popup on desktop and goes to next", async () => {
    setUserAgent(DESKTOP);
    fb.signInWithPopup.mockResolvedValue({ user });
    const GoogleSignIn = await load();
    render(<GoogleSignIn />);

    await userEvent.click(screen.getByRole("button", { name: /Continue with Google/ }));

    await waitFor(() => expect(assign).toHaveBeenCalledWith("/app/groups"));
    expect(fb.signInWithRedirect).not.toHaveBeenCalled();
    expect(fetch).toHaveBeenCalledWith("/auth/callback", expect.objectContaining({ method: "POST" }));
  });

  it("uses a same-tab redirect on iOS and remembers next", async () => {
    setUserAgent(IPHONE);
    fb.signInWithRedirect.mockReturnValue(new Promise(() => {})); // real one navigates away
    const GoogleSignIn = await load();
    render(<GoogleSignIn />);

    await userEvent.click(screen.getByRole("button", { name: /Continue with Google/ }));

    expect(fb.signInWithRedirect).toHaveBeenCalled();
    expect(fb.signInWithPopup).not.toHaveBeenCalled();
    expect(sessionStorage.getItem("sprintboard:sign-in-next")).toBe("/app/groups");
  });

  it("finishes a redirect sign-in on return", async () => {
    sessionStorage.setItem("sprintboard:sign-in-next", "/app/groups");
    fb.getRedirectResult.mockResolvedValue({ user });
    const GoogleSignIn = await load();
    render(<GoogleSignIn />);

    await waitFor(() => expect(assign).toHaveBeenCalledWith("/app/groups"));
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(sessionStorage.getItem("sprintboard:sign-in-next")).toBeNull();
  });

  it("re-enables the button when the user came back without signing in", async () => {
    sessionStorage.setItem("sprintboard:sign-in-next", "/app");
    fb.getRedirectResult.mockResolvedValue(null);
    const GoogleSignIn = await load();
    render(<GoogleSignIn />);

    await waitFor(() => expect(screen.getByRole("button", { name: /Continue with Google/ })).toBeEnabled());
    expect(fetch).not.toHaveBeenCalled();
    expect(assign).not.toHaveBeenCalled();
  });

  it("does not touch Firebase on an ordinary visit", async () => {
    const GoogleSignIn = await load();
    render(<GoogleSignIn />);
    expect(fb.getRedirectResult).not.toHaveBeenCalled();
  });
});
