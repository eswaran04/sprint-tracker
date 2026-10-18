"use client";

import { CalendarSync, Compass, MessageSquareText, Plus, Users } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AiBadge, AiSparkle } from "@/components/ui/ai-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useFeatureSeen } from "@/hooks/use-feature-seen";
import { useMyGroups } from "@/hooks/use-groups";
import { useSprints } from "@/hooks/use-sprints";
import { cn } from "@/lib/utils";
import { ProgressRing } from "@/components/progress-ring";

function AiNavLink({ href, onNavigate, isNew, icon, children }: {
  href: string; onNavigate?: () => void; isNew: boolean; icon: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      className="group flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-sidebar-accent"
    >
      <span className="text-[var(--ai-2)] transition-transform group-hover:scale-110">{icon}</span>
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {isNew && <AiBadge />}
    </Link>
  );
}

export function SprintNav({ onNavigate }: { onNavigate?: () => void }) {
  const { data, isLoading } = useSprints();
  const { data: groups } = useMyGroups();
  const path = usePathname();
  const [searchSeen] = useFeatureSeen("ai-search");
  const [coachSeen] = useFeatureSeen("smart-reschedule");
  // AI tools act on the open sprint, falling back to the first one.
  const aiTarget = data?.find((s) => path.startsWith(`/app/s/${s.id}`))?.id ?? data?.[0]?.id;
  return (
    <nav className="flex flex-col gap-0.5">
      <Link
        href="/app/explore"
        onClick={onNavigate}
        className={cn(
          "mb-3 flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-sidebar-accent",
          (path.startsWith("/app/explore") || path.startsWith("/app/sheets")) && "bg-sidebar-accent font-medium",
        )}
      >
        <Compass className="size-4 text-primary" /> Explore sheets
      </Link>
      {aiTarget && (
        <div className="mb-3 flex flex-col gap-0.5">
          <span className="flex items-center gap-1.5 px-2 pb-1.5 text-xs font-medium tracking-wide uppercase">
            <AiSparkle className="size-3" /> <span className="ai-text">AI tools</span>
          </span>
          <AiNavLink href={`/app/s/${aiTarget}?ai=search`} onNavigate={onNavigate} isNew={!searchSeen} icon={<MessageSquareText className="size-4" />}>
            Ask in plain words
          </AiNavLink>
          <AiNavLink href={`/app/s/${aiTarget}?ai=reschedule`} onNavigate={onNavigate} isNew={!coachSeen} icon={<CalendarSync className="size-4" />}>
            Smart reschedule
          </AiNavLink>
        </div>
      )}
      <div className="flex items-center justify-between px-2 pb-1.5">
        <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Sprints</span>
        <Link href="/app/import" onClick={onNavigate} className="rounded-md p-1 text-muted-foreground hover:bg-sidebar-accent hover:text-foreground" aria-label="New sprint">
          <Plus className="size-4" />
        </Link>
      </div>
      {isLoading && Array.from({ length: 2 }, (_, i) => <Skeleton key={i} className="mx-2 my-1 h-7" />)}
      {data?.map((s) => {
        const active = path.startsWith(`/app/s/${s.id}`);
        return (
          <Link
            key={s.id}
            href={`/app/s/${s.id}`}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-sidebar-accent",
              active && "bg-sidebar-accent font-medium",
            )}
          >
            <ProgressRing value={s.total ? s.done / s.total : 0} size={16} />
            <span className="min-w-0 flex-1 truncate">{s.title}</span>
            <span className="text-xs text-muted-foreground tabular-nums">{s.total ? Math.round((s.done / s.total) * 100) : 0}%</span>
          </Link>
        );
      })}
      {data?.length === 0 && <p className="px-2 py-1 text-xs text-muted-foreground">No sprints yet.</p>}
      {groups && groups.length > 0 && (
        <>
          <span className="mt-4 px-2 pb-1.5 text-xs font-medium tracking-wide text-muted-foreground uppercase">Groups</span>
          {groups.map((g) => (
            <Link
              key={g.id}
              href={`/app/groups/${g.id}`}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-sidebar-accent",
                path.startsWith(`/app/groups/${g.id}`) && "bg-sidebar-accent font-medium",
              )}
            >
              <Users className="size-4 text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate">{g.name}</span>
              <span className="text-xs text-muted-foreground tabular-nums">{g.member_count}</span>
            </Link>
          ))}
        </>
      )}
    </nav>
  );
}
