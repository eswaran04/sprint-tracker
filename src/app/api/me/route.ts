import { NextResponse, type NextRequest } from "next/server";
import { isAccent } from "@/lib/accents";
import { getSessionUser } from "@/lib/firebase/admin";
import { getUserRow, setAccent } from "@/lib/db/session";

export const runtime = "nodejs";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const row = await getUserRow(user.uid);
  return NextResponse.json({ data: { id: user.uid, email: user.email, accent: row?.accent ?? null } });
}

export async function PATCH(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const body = (await request.json().catch(() => null)) as { accent?: unknown } | null;
  if (!isAccent(body?.accent)) return NextResponse.json({ error: "Unknown accent" }, { status: 400 });
  await setAccent(user.uid, body.accent);
  return NextResponse.json({ data: null });
}
