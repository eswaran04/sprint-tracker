"use client";

import { useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { Bell } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useNudges } from "@/hooks/use-groups";
import { markNudgesSeen } from "@/lib/api";

/** Bell with a badge for unseen nudges from group members. Opening it marks them seen. */
export function NudgeInbox() {
  const qc = useQueryClient();
  const nudges = useNudges().data ?? [];
  const count = nudges.length;

  const onOpenChange = (open: boolean) => {
    if (open && count > 0) void markNudgesSeen().catch(() => {});
    // Refresh on close so the list stays readable while it's open.
    if (!open) void qc.invalidateQueries({ queryKey: ["nudges"] });
  };

  return (
    <Popover onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label={count ? `${count} new nudge${count === 1 ? "" : "s"}` : "Nudges"}>
          <Bell />
          {count > 0 && (
            <span className="absolute top-0.5 right-0.5 flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground tabular-nums">
              {count}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-1.5">
        {count === 0 ? (
          <p className="px-2 py-3 text-center text-sm text-muted-foreground">No new nudges</p>
        ) : (
          nudges.map((n) => (
            <Link key={n.id} href={`/app/groups/${n.group_id}`} className="block rounded-md px-2 py-2 text-sm hover:bg-muted">
              <span className="font-medium">{n.sender_name}</span> nudged you in <span className="font-medium">{n.group_name}</span>
              {n.message && (
                <q className="mt-1 block border-l-2 border-primary/40 pl-2 text-xs break-words text-muted-foreground italic">{n.message}</q>
              )}
              <span className="block text-xs text-muted-foreground">{formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}</span>
            </Link>
          ))
        )}
      </PopoverContent>
    </Popover>
  );
}
