"use client";

import { Brain, CalendarSync, Code2, Compass, FileChartColumn, FileSpreadsheet, MessageSquareText, Newspaper, Plus, Sparkles, Users } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AiBadge, AiSparkle } from "@/components/ui/ai-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useFeatureSeen } from "@/hooks/use-feature-seen";
import { useMyGroups } from "@/hooks/use-groups";
import { useSprints } from "@/hooks/use-sprints";
import { openAiTour } from "@/lib/ai-tour-store";
import { cn } from "@/lib/utils";
import { ProgressRing } from "@/components/progress-ring";

function AiNavLink({ href, onNavigate, isNew, active, icon, children }: {
  href: string; onNavigate?: () => void; isNew: boolean; active?: boolean; icon: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      className={cn(
        "group flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-sidebar-accent",
        active && "bg-sidebar-accent font-medium",
      )}
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
  const [generatorSeen] = useFeatureSeen("sheet-generator");
  const [warmupSeen] = useFeatureSeen("daily-warmup");
  const [reviewSeen] = useFeatureSeen("code-review");
  const [reportSeen] = useFeatureSeen("readiness-report");
  const [digestSeen] = useFeatureSeen("group-digest");
  // AI tools act on the open sprint, falling back to the first one.
  const aiTarget = data?.find((s) => path.startsWith(`/app/s/${s.id}`))?.id ?? data?.[0]?.id;
  // The digest lives on a group page: the open group, else the one linked to the open sprint, else the first.
  const digestTarget =
    groups?.find((g) => path.startsWith(`/app/groups/${g.id}`))?.id ??
    groups?.find((g) => g.sprint_id === aiTarget)?.id ??
    groups?.[0]?.id;
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
      <div className="mb-3 flex flex-col gap-0.5">
        <div className="flex items-center justify-between px-2 pb-1.5">
          <span className="flex items-center gap-1.5 text-xs font-medium tracking-wide uppercase">
            <AiSparkle className="size-3" /> <span className="ai-text">AI tools</span>
          </span>
          <button
            type="button"
            onClick={() => {
              onNavigate?.();
              openAiTour(0);
            }}
            className="group flex items-center gap-1 rounded-full border border-[var(--ai-2)]/30 bg-[var(--ai-2)]/10 px-2 py-0.5 text-[10px] font-medium text-[var(--ai-2)] transition-all hover:bg-[var(--ai-2)]/20 hover:border-[var(--ai-2)]/60 cursor-pointer"
            title="Take a tour of the AI features"
            aria-label="Take AI features tour"
          >
            <Sparkles className="size-2.5 transition-transform group-hover:rotate-12" />
            <span>Tour</span>
          </button>
        </div>
        <AiNavLink href="/app/import" onNavigate={onNavigate} isNew={!generatorSeen} active={path.startsWith("/app/import")} icon={<FileSpreadsheet className="size-4" />}>
          Generate a sheet
        </AiNavLink>
        {aiTarget && (
          <>
            <AiNavLink href={`/app/s/${aiTarget}?ai=search`} onNavigate={onNavigate} isNew={!searchSeen} icon={<MessageSquareText className="size-4" />}>
              Ask in plain words
            </AiNavLink>
            <AiNavLink href={`/app/s/${aiTarget}?ai=reschedule`} onNavigate={onNavigate} isNew={!coachSeen} icon={<CalendarSync className="size-4" />}>
              Smart reschedule
            </AiNavLink>
            <AiNavLink href={`/app/s/${aiTarget}?ai=warmup`} onNavigate={onNavigate} isNew={!warmupSeen} icon={<Brain className="size-4" />}>
              5-min warmup
            </AiNavLink>
            <AiNavLink href={`/app/s/${aiTarget}?ai=review`} onNavigate={onNavigate} isNew={!reviewSeen} icon={<Code2 className="size-4" />}>
              Code &amp; intuition review
            </AiNavLink>
            <AiNavLink
              href={`/app/s/${aiTarget}/stats?report=1`}
              onNavigate={onNavigate}
              isNew={!reportSeen}
              active={path.startsWith(`/app/s/${aiTarget}/stats`)}
              icon={<FileChartColumn className="size-4" />}
            >
              Readiness report
            </AiNavLink>
          </>
        )}
        {digestTarget && (
          <AiNavLink
            href={`/app/groups/${digestTarget}#weekly-digest`}
            onNavigate={onNavigate}
            isNew={!digestSeen}
            icon={<Newspaper className="size-4" />}
          >
            Group weekly digest
          </AiNavLink>
        )}
      </div>
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
