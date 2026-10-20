"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format, subDays } from "date-fns";
import { useMemo } from "react";
import { toast } from "sonner";
import { getGroup, groupActivity, groupDigest, groupProgress, groupReactions, listMyGroups, myNudges, toggleReaction } from "@/lib/api";
import { activityItems } from "@/lib/activity";
import { leaderboard, progressIndex } from "@/lib/groups";
import type { GroupReaction } from "@/lib/types";

export const useMyGroups = () => useQuery({ queryKey: ["groups"], queryFn: listMyGroups });

/** The group (if any) your sprint is linked to. */
export function useGroupForSprint(sprintId: string) {
  const { data } = useMyGroups();
  return data?.find((g) => g.sprint_id === sprintId) ?? null;
}

/** Roster + who-completed-what for a group, refreshed every minute and on focus. */
export function useGroupProgress(groupId: string | null | undefined) {
  const group = useQuery({
    queryKey: ["group", groupId],
    queryFn: () => getGroup(groupId!),
    enabled: Boolean(groupId),
  });
  const progress = useQuery({
    queryKey: ["group-progress", groupId],
    queryFn: () => groupProgress(groupId!),
    enabled: Boolean(groupId),
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });

  return useMemo(() => {
    const members = group.data?.members ?? [];
    const rows = progress.data ?? [];
    return {
      group: group.data?.group ?? null,
      members,
      index: progressIndex(rows),
      board: leaderboard(members, rows, format(new Date(), "yyyy-MM-dd")),
      isLoading: group.isLoading || progress.isLoading,
      notFound: group.isFetched && group.data === null,
      error: group.error ?? progress.error,
    };
  }, [group.data, group.isLoading, group.isFetched, group.error, progress.data, progress.isLoading, progress.error]);
}

/** Weekly AI digest for a group. Keyed by local day; refreshed at most every 30 minutes (and on group refresh). */
export function useGroupDigest(groupId: string | null | undefined) {
  const today = format(new Date(), "yyyy-MM-dd");
  return useQuery({
    queryKey: ["group-digest", groupId, today],
    queryFn: () => groupDigest(groupId!, today),
    enabled: Boolean(groupId),
    staleTime: 30 * 60_000,
    retry: false,
  });
}

/** Unseen nudges from group members, checked every minute and on focus. */
export const useNudges = () =>
  useQuery({ queryKey: ["nudges"], queryFn: myNudges, refetchInterval: 60_000, refetchOnWindowFocus: true });

const reactionsKey = (groupId: string | null | undefined) => ["group-reactions", groupId];

/** Feed items (one per member per day) with their claps, refreshed every minute and on focus. */
export function useGroupActivity(groupId: string | null | undefined, me: string | undefined) {
  const live = { enabled: Boolean(groupId), refetchInterval: 60_000, refetchOnWindowFocus: true };
  const events = useQuery({ queryKey: ["group-activity", groupId], queryFn: () => groupActivity(groupId!), ...live });
  const reactions = useQuery({
    queryKey: reactionsKey(groupId),
    queryFn: () => groupReactions(groupId!, format(subDays(new Date(), 8), "yyyy-MM-dd")),
    ...live,
  });
  const items = useMemo(() => activityItems(events.data ?? [], reactions.data ?? [], me ?? ""), [events.data, reactions.data, me]);
  return { items, isLoading: events.isLoading };
}

/** Clap for a member's day (or undo it): updates instantly, rolls back with a toast if saving fails. */
export function useToggleReaction(groupId: string, me: string | undefined) {
  const qc = useQueryClient();
  const key = reactionsKey(groupId);
  return useMutation({
    mutationFn: ({ target, day }: { target: string; day: string }) => toggleReaction(groupId, target, day),
    onMutate: async ({ target, day }) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<GroupReaction[]>(key) ?? [];
      const mine = (r: GroupReaction) => r.target_user === target && r.day === day && r.reactor === me;
      qc.setQueryData<GroupReaction[]>(
        key,
        prev.some(mine) ? prev.filter((r) => !mine(r)) : [...prev, { group_id: groupId, target_user: target, day, reactor: me ?? "" }],
      );
      return { prev };
    },
    onError: (err, _v, ctx) => {
      qc.setQueryData(key, ctx?.prev);
      toast.error("Couldn't send 👏", { description: err.message });
    },
    onSettled: () => qc.invalidateQueries({ queryKey: key }),
  });
}
