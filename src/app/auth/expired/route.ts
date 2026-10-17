import { SESSION_COOKIE } from "@/lib/firebase/env";
import { relativeRedirect } from "@/lib/redirect";

/** Clears a stale session cookie and returns to sign-in (avoids a "/" <-> "/app" redirect loop). */
export function GET() {
  const res = relativeRedirect("/");
  res.cookies.delete(SESSION_COOKIE);
  return res;
}
