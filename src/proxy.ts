import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/firebase/env";

/**
 * Cheap redirects based on whether a session cookie exists. This is NOT the auth check: `app/app/layout.tsx`
 * and every `/api` route verify the cookie with firebase-admin and reject invalid or revoked sessions.
 */
export function proxy(request: NextRequest) {
  const signedIn = Boolean(request.cookies.get(SESSION_COOKIE)?.value);
  const path = request.nextUrl.pathname;

  if (!signedIn && path.startsWith("/app")) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }
  if (signedIn && path === "/") {
    const url = request.nextUrl.clone();
    url.pathname = "/app";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
