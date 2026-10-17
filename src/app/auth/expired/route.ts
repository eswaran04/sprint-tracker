import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/firebase/env";

/** Clears a stale session cookie and returns to sign-in (avoids a "/" <-> "/app" redirect loop). */
export function GET(request: NextRequest) {
  const res = NextResponse.redirect(new URL("/", request.url));
  res.cookies.delete(SESSION_COOKIE);
  return res;
}
