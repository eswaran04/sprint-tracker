import { adminAuth, getSessionUser } from "@/lib/firebase/admin";
import { SESSION_COOKIE } from "@/lib/firebase/env";
import { relativeRedirect } from "@/lib/redirect";

export const runtime = "nodejs";

export async function POST() {
  const user = await getSessionUser();
  if (user) await adminAuth().revokeRefreshTokens(user.uid).catch(() => {});
  const res = relativeRedirect("/", 303);
  res.cookies.delete(SESSION_COOKIE);
  return res;
}

/**
 * A GET here is a reload/back-navigation onto the sign-out URL, not a sign-out request (that's POST only,
 * so other sites can't log users out with a link). Send it home instead of rendering an empty 405 page.
 */
export function GET() {
  return relativeRedirect("/");
}
