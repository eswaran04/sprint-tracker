/**
 * Helpers for choosing between Firebase's popup and redirect sign-in.
 *
 * On iOS (every browser there is WebKit) and other mobile browsers the popup opens as a new tab that often never
 * closes, leaving the user on Firebase's blank /__/auth/handler page. Redirect sign-in stays in one tab. It needs
 * authDomain to be the app's own domain (with /__/auth/* proxied, see auth-proxy.ts) so the result can be read
 * back first-party. https://firebase.google.com/docs/auth/web/redirect-best-practices
 */

const NEXT_KEY = "sprintboard:sign-in-next";

export function prefersRedirectSignIn(userAgent: string, maxTouchPoints = 0): boolean {
  if (/iPhone|iPad|iPod/i.test(userAgent)) return true;
  // iPadOS 13+ reports a desktop Mac user agent; touch support gives it away.
  if (/Macintosh/i.test(userAgent) && maxTouchPoints > 1) return true;
  return /Android|Mobi/i.test(userAgent);
}

/** Only same-site relative paths; anything else falls back to /app. */
export function safeNextPath(next: string | null | undefined): string {
  return next && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\") ? next : "/app";
}

/** Remembers where to go after the redirect round-trip (query params are lost on the way back). */
export function rememberNext(next: string, storage: Pick<Storage, "setItem"> = sessionStorage) {
  try {
    storage.setItem(NEXT_KEY, safeNextPath(next));
  } catch {
    // Private mode / storage disabled: we just land on /app.
  }
}

/** True only in the tab that started a redirect sign-in, so ordinary visits never call getRedirectResult. */
export function hasRememberedNext(storage: Pick<Storage, "getItem"> = sessionStorage): boolean {
  try {
    return storage.getItem(NEXT_KEY) !== null;
  } catch {
    return false;
  }
}

export function takeRememberedNext(storage: Pick<Storage, "getItem" | "removeItem"> = sessionStorage): string {
  try {
    const next = storage.getItem(NEXT_KEY);
    storage.removeItem(NEXT_KEY);
    return safeNextPath(next);
  } catch {
    return "/app";
  }
}
