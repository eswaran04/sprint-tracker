import { NextResponse, type NextRequest } from "next/server";
import { adminAuth, getSessionUser } from "@/lib/firebase/admin";
import { SESSION_COOKIE } from "@/lib/firebase/env";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (user) await adminAuth().revokeRefreshTokens(user.uid).catch(() => {});
  const res = NextResponse.redirect(new URL("/", request.url), { status: 303 });
  res.cookies.delete(SESSION_COOKIE);
  return res;
}
