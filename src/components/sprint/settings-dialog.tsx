"use client";

import { format, parseISO } from "date-fns";
import { CalendarIcon, Globe, Link2, Lock, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useSessionUser } from "@/components/shell/session-user";
import { isVivaEnabled, setVivaEnabled } from "@/hooks/use-recall";
import { deleteSprint, type SprintPatch } from "@/lib/api";
import type { Sprint } from "@/lib/types";

const iso = (d: Date) => format(d, "yyyy-MM-dd");

export function SettingsDialog({ sprint, open, onOpenChange, onSave }: {
  sprint: Sprint; open: boolean; onOpenChange: (o: boolean) => void; onSave: (p: SprintPatch) => Promise<unknown>;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        {open && <SettingsForm sprint={sprint} onDone={() => onOpenChange(false)} onSave={onSave} />}
      </DialogContent>
    </Dialog>
  );
}

function SettingsForm({ sprint, onDone, onSave }: { sprint: Sprint; onDone: () => void; onSave: (p: SprintPatch) => Promise<unknown> }) {
  const router = useRouter();
  const qc = useQueryClient();
  const [title, setTitle] = useState(sprint.title);
  const [start, setStart] = useState<string | null>(sprint.start_date);
  const [skipWeekends, setSkipWeekends] = useState(sprint.skip_weekends);
  const [rest, setRest] = useState<string[]>(sprint.rest_days);
  const [isPublic, setIsPublic] = useState(sprint.visibility === "public");
  const [description, setDescription] = useState(sprint.description);
  const [showOwner, setShowOwner] = useState(sprint.show_owner);
  const [viva, setViva] = useState(() => isVivaEnabled(sprint.id));
  const user = useSessionUser();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    setVivaEnabled(sprint.id, viva);
    try {
      await onSave({
        title: title.trim() || sprint.title,
        start_date: start,
        skip_weekends: skipWeekends,
        rest_days: [...rest].sort(),
        visibility: isPublic ? "public" : "private",
        description: description.trim(),
        show_owner: showOwner,
        // Snapshot the display name/avatar at publish time (never the email).
        owner_name: user?.name ?? sprint.owner_name,
        owner_avatar: user?.avatar ?? sprint.owner_avatar,
        published_at: isPublic ? (sprint.published_at ?? new Date().toISOString()) : sprint.published_at,
      });
      toast.success("Sprint updated");
      onDone();
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    try {
      await deleteSprint(sprint.id);
      await qc.invalidateQueries({ queryKey: ["sprints"] });
      toast.success("Sprint deleted");
      router.push("/app");
    } catch (e) {
      toast.error("Couldn't delete", { description: (e as Error).message });
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-5">
      <DialogHeader>
        <DialogTitle>Sprint settings</DialogTitle>
        <DialogDescription>Map plan days onto your calendar.</DialogDescription>
      </DialogHeader>

      <div className="grid gap-2">
        <Label htmlFor="sprint-title">Name</Label>
        <Input id="sprint-title" value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>

      <div className="grid gap-2">
        <Label>Start date (Day 1)</Label>
        <div className="flex gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="flex-1 justify-start gap-2 font-normal">
                <CalendarIcon className="size-4 opacity-60" />
                {start ? format(parseISO(start), "PPP") : <span className="text-muted-foreground">Pick a date</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={start ? parseISO(start) : undefined} onSelect={(d) => setStart(d ? iso(d) : null)} />
            </PopoverContent>
          </Popover>
          <Button variant="outline" onClick={() => setStart(iso(new Date()))}>Today</Button>
        </div>
      </div>

      <label className="flex items-center justify-between gap-4 rounded-lg border p-3">
        <span>
          <span className="block text-sm font-medium">Skip weekends</span>
          <span className="block text-xs text-muted-foreground">Saturdays and Sundays aren&apos;t plan days.</span>
        </span>
        <Switch checked={skipWeekends} onCheckedChange={setSkipWeekends} />
      </label>

      <label className="flex items-center justify-between gap-4 rounded-lg border p-3">
        <span>
          <span className="block text-sm font-medium">Viva check on theory topics</span>
          <span className="block text-xs text-muted-foreground">
            Marking a DBMS/OOPS/OS/CN topic done offers a 2-question rapid-fire check first. Saved on this device.
          </span>
        </span>
        <Switch checked={viva} onCheckedChange={setViva} aria-label="Viva check on theory topics" />
      </label>

      <div className="grid gap-2">
        <Label>Rest days</Label>
        <p className="text-xs text-muted-foreground">Pick days off — the plan skips them.</p>
        <div className="flex justify-center rounded-lg border">
          <Calendar
            mode="multiple"
            selected={rest.map((d) => parseISO(d))}
            onSelect={(ds) => setRest((ds ?? []).map(iso))}
            defaultMonth={start ? parseISO(start) : undefined}
          />
        </div>
        {rest.length > 0 && (
          <button onClick={() => setRest([])} className="justify-self-start text-xs text-muted-foreground hover:text-foreground">
            Clear {rest.length} rest day{rest.length > 1 ? "s" : ""}
          </button>
        )}
      </div>

      <div className="grid gap-3 rounded-lg border p-3">
        <label className="flex items-center justify-between gap-4">
          <span className="flex items-start gap-2.5">
            {isPublic ? <Globe className="mt-0.5 size-4 text-primary" /> : <Lock className="mt-0.5 size-4 text-muted-foreground" />}
            <span>
              <span className="block text-sm font-medium">Public sheet</span>
              <span className="block text-xs text-muted-foreground">
                Listed in Explore. Others can view the problems and copy the sheet — never your progress or notes.
              </span>
            </span>
          </span>
          <Switch checked={isPublic} onCheckedChange={setIsPublic} aria-label="Public sheet" />
        </label>
        {isPublic && (
          <>
            <div className="grid gap-1.5">
              <Label htmlFor="sheet-description">Description</Label>
              <Textarea
                id="sheet-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={500}
                placeholder="Who is this sheet for? What does it cover?"
                className="min-h-20"
              />
            </div>
            <label className="flex items-center justify-between gap-4">
              <span className="text-sm">Show my name{user?.name ? ` (${user.name})` : ""}</span>
              <Switch checked={showOwner} onCheckedChange={setShowOwner} aria-label="Show my name" />
            </label>
            {sprint.visibility === "public" && (
              <Button
                variant="outline"
                size="sm"
                className="justify-self-start"
                onClick={async () => {
                  await navigator.clipboard.writeText(`${location.origin}/app/sheets/${sprint.id}`);
                  toast.success("Link copied");
                }}
              >
                <Link2 /> Copy share link
              </Button>
            )}
          </>
        )}
      </div>

      <DialogFooter className="flex-row items-center sm:justify-between">
        {confirmDelete ? (
          <Button variant="destructive" onClick={remove} disabled={busy}>Delete forever?</Button>
        ) : (
          <Button variant="ghost" className="text-destructive" onClick={() => setConfirmDelete(true)}>
            <Trash2 /> Delete
          </Button>
        )}
        <Button onClick={save} disabled={busy} className="ml-auto">Save</Button>
      </DialogFooter>
    </div>
  );
}
