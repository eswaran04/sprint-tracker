import { NextResponse } from "next/server";

/**
 * Redirect with a relative `Location` (e.g. "/"), resolved by the browser against the public URL it is on.
 *
 * Don't build redirects from `request.url` in route handlers: behind App Hosting's proxy it carries the
 * container's internal origin (`0.0.0.0:8080`), so the browser gets sent there and refuses to load it.
 */
export function relativeRedirect(path: string, status: 302 | 303 | 307 = 307) {
  if (!path.startsWith("/") || path.startsWith("//")) throw new Error(`Not a same-origin path: ${path}`);
  return new NextResponse(null, { status, headers: { Location: path } });
}
