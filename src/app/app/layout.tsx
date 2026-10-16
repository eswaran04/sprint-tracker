import { redirect } from "next/navigation";
import { AppShell } from "@/components/shell/app-shell";
import { getSessionUser } from "@/lib/firebase/admin";
import { getUserRow } from "@/lib/db/session";

export default async function AppLayout({ children }: LayoutProps<"/app">) {
  const auth = await getSessionUser();
  // An invalid/expired cookie would bounce between "/" and "/app" via the proxy; signout clears it.
  if (!auth) redirect("/auth/expired");
  const row = await getUserRow(auth.uid);
  const user = {
    id: auth.uid,
    email: auth.email,
    name: row?.display_name ?? auth.name ?? (auth.email || "You"),
    avatar: row?.avatar_url ?? auth.picture ?? null,
    accent: row?.accent ?? null,
  };
  return <AppShell user={user}>{children}</AppShell>;
}
