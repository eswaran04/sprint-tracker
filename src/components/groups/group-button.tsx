"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, Copy, Loader2, Users } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { AiBadge, AiSparkle } from "@/components/ui/ai-badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSessionUser } from "@/components/shell/session-user";
import { useFeatureSeen } from "@/hooks/use-feature-seen";
import { useGroupForSprint, useGroupProgress } from "@/hooks/use-groups";
import { createGroup, listMyGroups } from "@/lib/api";
import { cn } from "@/lib/utils";
import { AvatarStack } from "./member-avatar";

export const inviteUrl = (code: string) => `${location.origin}/app/join/${code}`;

export function CopyInvite({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex gap-2">
      <Input readOnly value={inviteUrl(code)} onFocus={(e) => e.currentTarget.select()} className="font-mono text-xs" aria-label="Invite link" />
      <Button
        variant="outline"
        onClick={async () => {
          await navigator.clipboard.writeText(inviteUrl(code));
          setCopied(true);
          toast.success("Invite link copied");
          setTimeout(() => setCopied(false), 1500);
        }}
      >
        {copied ? <Check /> : <Copy />} Copy
      </Button>
    </div>
  );
}

/** Sprint-header entry point: start a group, or jump to the one this sprint belongs to. */
export function GroupButton({ sprintId, sprintTitle }: { sprintId: string; sprintTitle: string }) {
  const linked = useGroupForSprint(sprintId);
  const { members } = useGroupProgress(linked?.id);
  const user = useSessionUser();
  const [digestSeen] = useFeatureSeen("group-digest");
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(`${sprintTitle} group`);
  const [code, setCode] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: () => createGroup(sprintId, name, { name: user?.name ?? "Owner", avatar: user?.avatar ?? null }),
    onSuccess: async () => {
      const groups = await qc.fetchQuery({ queryKey: ["groups"], queryFn: listMyGroups });
      setCode(groups.find((g) => g.sprint_id === sprintId)?.invite_code ?? null);
      toast.success("Group created — share the invite link");
    },
    onError: (e) => toast.error("Couldn't create group", { description: e.message }),
  });

  if (linked) {
    // Until the weekly digest has been seen, the button gets the AI border and points straight at the card.
    return (
      <Button variant="outline" size="sm" asChild className={cn("relative rounded-lg", !digestSeen && "ai-border ai-glow")}>
        <Link
          href={`/app/groups/${linked.id}${digestSeen ? "" : "#weekly-digest"}`}
          title={digestSeen ? undefined : "New: AI weekly digest for your group"}
        >
          {members.length > 0 ? <AvatarStack members={members} max={3} size="size-4" /> : <Users />}
          <span className="max-sm:hidden">Group</span>
          {!digestSeen && (
            <>
              <AiSparkle className="size-3.5" />
              <AiBadge className="pointer-events-none absolute -top-2 -right-2 shadow-sm" />
            </>
          )}
        </Link>
      </Button>
    );
  }

  return (
    <>
      <Button variant="outline" size="sm" className="rounded-lg" onClick={() => setOpen(true)}>
        <Users /> <span className="max-sm:hidden">Group</span>
      </Button>
      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setCode(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{code ? "Invite your friends" : "Start a study group"}</DialogTitle>
            <DialogDescription>
              {code
                ? "Anyone with this link can join. They get their own copy of the sheet, and you'll all see who completed what."
                : "Follow this sheet together. Members see each other's completed problems — notes and stars stay private."}
            </DialogDescription>
          </DialogHeader>
          {code ? (
            <>
              <CopyInvite code={code} />
              <DialogFooter><Button onClick={() => setOpen(false)}>Done</Button></DialogFooter>
            </>
          ) : (
            <form onSubmit={(e) => { e.preventDefault(); create.mutate(); }} className="grid gap-4">
              <div className="grid gap-1.5">
                <Label htmlFor="group-name">Group name</Label>
                <Input id="group-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} autoFocus />
              </div>
              <DialogFooter>
                <Button type="submit" disabled={create.isPending || !name.trim()}>
                  {create.isPending && <Loader2 className="animate-spin" />} Create group
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
