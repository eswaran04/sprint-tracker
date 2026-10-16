import { NextResponse, type NextRequest } from "next/server";
import { adminAuth } from "@/lib/firebase/admin";
import { SESSION_COOKIE, SESSION_MAX_AGE_MS } from "@/lib/firebase/env";
import { upsertUser } from "@/lib/db/session";

export const runtime = "nodejs";

/** Exchanges a fresh Firebase ID token (from the Google popup) for an httpOnly session cookie. */
export async function POST(request: NextRequest) {
  // CSRF: only accept same-origin posts.
  const origin = request.headers.get("origin");
  if (origin && origin !== request.nextUrl.origin) return NextResponse.json({ error: "Bad origin" }, { status: 403 });

  const body = (await request.json().catch(() => null)) as { idToken?: unknown } | null;
  if (typeof body?.idToken !== "string") return NextResponse.json({ error: "Missing token" }, { status: 400 });

  try {
    const auth = adminAuth();
    const token = await auth.verifyIdToken(body.idToken, true);
    // Only mint sessions from a recent sign-in, not a long-lived cached token.
    if (Date.now() / 1000 - token.auth_time > 5 * 60) {
      return NextResponse.json({ error: "Please sign in again" }, { status: 401 });
    }
    const session = await auth.createSessionCookie(body.idToken, { expiresIn: SESSION_MAX_AGE_MS });
    await upsertUser({
      uid: token.uid,
      email: token.email ?? "",
      name: typeof token.name === "string" ? token.name : null,
      picture: typeof token.picture === "string" ? token.picture : null,
    });

    const res = NextResponse.json({ data: null });
    res.cookies.set(SESSION_COOKIE, session, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_MAX_AGE_MS / 1000,
    });
    return res;
  } catch (e) {
    console.error("[auth/callback]", e);
    return NextResponse.json({ error: "Sign-in failed" }, { status: 401 });
  }
}
