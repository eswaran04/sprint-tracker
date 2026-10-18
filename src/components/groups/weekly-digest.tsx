"use client";

import { Bell, Check, Users } from "lucide-react";
import { useEffect } from "react";
import { AiBadge, AiSparkle } from "@/components/ui/ai-badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { DifficultyChip } from "@/components/sprint/chips";
import { useFeatureSeen } from "@/hooks/use-feature-seen";
import type { GroupDigest, GroupMember } from "@/lib/types";
import { NudgeComposer } from "./nudge-composer";

/**
 * "This week in {group}": facts computed server-side, worded by Gemini (AI badge) or the built-in template.
 * Pair-ups always come from the facts. Hidden when there's nothing to show or the digest can't load.
 */
export function WeeklyDigest({ digest, isLoading, members, nudged, suggestionsFor, onNudge }: {
  digest: GroupDigest | null | undefined;
  isLoading: boolean;
  members: GroupMember[];
  nudged: Set<string>;
  suggestionsFor: (member: GroupMember, problem?: string) => string[];
  onNudge: (member: GroupMember, message: string | null) => void;
}) {
  const [seen, markSeen] = useFeatureSeen("group-digest");
  const ready = Boolean(digest);

  // Arriving from the sidebar's "Group weekly digest" link: the card loads after the page, so scroll once it's there.
  useEffect(() => {
    if (ready && window.location.hash === "#weekly-digest") {
      document.getElementById("weekly-digest")?.scrollIntoView?.({ behavior: "smooth", block: "start" });
      markSeen();
    }
  }, [ready, markSeen]);

  if (isLoading) {
    return (
      <section aria-label="Loading weekly digest" className="ai-border ai-glow grid gap-2 rounded-2xl px-5 py-4 [--ai-fill:var(--card)]">
        <Skeleton className="h-5 w-2/3" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
      </section>
    );
  }
  if (!digest || (!digest.lines.length && !digest.pairUp.length)) return null;

  const byId = new Map(members.map((m) => [m.user_id, m]));

  return (
    <section
      id="weekly-digest"
      aria-label="Weekly digest"
      onPointerEnter={markSeen}
      className="ai-border ai-glow relative grid scroll-mt-24 gap-3 overflow-hidden rounded-2xl px-5 py-4 [--ai-fill:var(--card)]"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -top-16 -right-16 size-48 rounded-full bg-[radial-gradient(circle,color-mix(in_oklch,var(--ai-2)_22%,transparent),transparent_70%)]"
      />
      <div className="flex items-center gap-2 text-xs font-medium tracking-wide uppercase">
        <AiSparkle className="size-3.5" />
        <span className="ai-text">This week</span>
        {digest.ai && <AiBadge label="AI" />}
        {!seen && <AiBadge />}
        <span className="ml-auto font-normal tracking-normal text-muted-foreground normal-case tabular-nums">
          {digest.weekSolves} solve{digest.weekSolves === 1 ? "" : "s"} in 7 days
        </span>
      </div>

      <h2 className="text-lg leading-snug font-semibold tracking-tight">{digest.headline}</h2>
      <ul className="grid gap-1.5 text-sm text-muted-foreground">
        {digest.lines.map((l, i) => (
          <li key={i} className="flex gap-2">
            <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-[var(--ai-2)]" />
            <span>{l}</span>
          </li>
        ))}
      </ul>

      {digest.pairUp.length > 0 && (
        <div className="grid gap-1.5 border-t pt-3">
          <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Users className="size-3.5" /> Pair up
          </p>
          <ul className="grid gap-1">
            {digest.pairUp.map((p) => {
              const partner = byId.get(p.partner.userId);
              return (
                <li key={p.problem.key} className="flex flex-wrap items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-muted/40">
                  <span className="min-w-0 flex-1 truncate">
                    <span className="font-medium">{p.partner.name}</span> solved{" "}
                    {p.problem.url ? (
                      <a href={p.problem.url} target="_blank" rel="noreferrer" className="hover:text-primary hover:underline">{p.problem.name}</a>
                    ) : (
                      p.problem.name
                    )}
                    {p.dueForMe && <span className="text-xs text-muted-foreground"> · due for you</span>}
                  </span>
                  <DifficultyChip difficulty={p.problem.difficulty} className="shrink-0" />
                  {partner && (nudged.has(partner.user_id) ? (
                    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><Check className="size-3.5" /> Nudged</span>
                  ) : (
                    <NudgeComposer member={partner} suggestions={suggestionsFor(partner, p.problem.name)} onSend={(msg) => onNudge(partner, msg)}>
                      <Button variant="outline" size="xs" className="ai-border [--ai-fill:var(--card)]" aria-label={`Nudge ${partner.display_name} about ${p.problem.name}`}>
                        <Bell /> Nudge {partner.display_name}
                      </Button>
                    </NudgeComposer>
                  ))}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        {digest.ai ? (
          <>
            <AiSparkle className="size-3" /> Summarised by <span className="ai-text font-medium">Gemini</span> from your group&apos;s progress
          </>
        ) : (
          "Auto-summary from your group's progress"
        )}
      </p>
    </section>
  );
}
