"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, Link2, Loader2, MessageCircle, RefreshCw, Trash2 } from "lucide-react";
import { parseAsBoolean, useQueryState } from "nuqs";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { AiBadge, AiSparkle } from "@/components/ui/ai-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useFeatureSeen } from "@/hooks/use-feature-seen";
import { generateShareReport, getMyShareReport, stopSharing } from "@/lib/api";
import { readinessHeadline } from "@/lib/readiness";
import type { ShareReportResponse } from "@/lib/share/schema";

const shareUrl = (slug: string) => `${location.origin}/share/${slug}`;
const imageUrl = (r: ShareReportResponse) => `/api/og/sprint/${r.sprint_id}?v=${encodeURIComponent(r.updated_at)}`;

function XIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" fill="currentColor" aria-hidden>
      <path d="M18.9 2H22l-7.6 8.7L23 22h-6.8l-5.3-6.9L4.8 22H1.7l8.1-9.3L1 2h7l4.8 6.3L18.9 2Zm-1.2 18h1.9L6.4 3.9h-2L17.7 20Z" />
    </svg>
  );
}

function LinkedInIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" fill="currentColor" aria-hidden>
      <path d="M20.4 20.5h-3.6v-5.6c0-1.3 0-3-1.8-3s-2.1 1.4-2.1 2.9v5.7H9.3V9h3.4v1.6h.1c.5-.9 1.6-1.8 3.4-1.8 3.6 0 4.3 2.4 4.3 5.5v6.2ZM5.3 7.4a2.1 2.1 0 1 1 0-4.2 2.1 2.1 0 0 1 0 4.2Zm1.8 13.1H3.5V9h3.6v11.5ZM22.2 0H1.8C.8 0 0 .8 0 1.7v20.6c0 .9.8 1.7 1.8 1.7h20.4c1 0 1.8-.8 1.8-1.7V1.7C24 .8 23.2 0 22.2 0Z" />
    </svg>
  );
}

async function copy(text: string, message: string, description?: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(message, { description });
  } catch {
    toast.error("Couldn't copy", { description: text });
  }
}

/** "Generate Readiness Report": builds the shareable snapshot and offers copy/X/LinkedIn/Discord/PNG. */
export function ShareReportDialog({ sprintId, title }: { sprintId: string; title: string }) {
  const [open, setOpenState] = useState(false);
  const [confirmStop, setConfirmStop] = useState(false);
  const [seen, markSeen] = useFeatureSeen("readiness-report");
  const setOpen = (next: boolean) => {
    if (next) markSeen();
    setOpenState(next);
  };
  // Deep link from the sidebar / ⌘K (`?report=1`): open the dialog once, then drop the param.
  const [reportIntent, setReportIntent] = useQueryState("report", parseAsBoolean.withOptions({ history: "replace" }));
  useEffect(() => {
    if (!reportIntent) return;
    const t = setTimeout(() => {
      void setReportIntent(null);
      markSeen();
      setOpenState(true);
    }, 0);
    return () => clearTimeout(t);
  }, [reportIntent, setReportIntent, markSeen]);
  const qc = useQueryClient();
  const key = ["share-report", sprintId];

  const existing = useQuery({ queryKey: key, queryFn: () => getMyShareReport(sprintId), enabled: open });

  const generate = useMutation({
    mutationFn: () => generateShareReport(sprintId),
    onSuccess: (data) => qc.setQueryData(key, data),
    onError: (e) => toast.error("Couldn't create the report", { description: e.message }),
  });

  const stop = useMutation({
    mutationFn: () => stopSharing(sprintId),
    onSuccess: () => {
      qc.setQueryData(key, null);
      setConfirmStop(false);
      setOpen(false);
      toast.success("Sharing stopped", { description: "The link and image no longer work." });
    },
    onError: (e) => toast.error("Couldn't stop sharing", { description: e.message }),
  });

  // First open with no report yet: generate one straight away.
  const autoStarted = useRef(false);
  const { mutate } = generate;
  useEffect(() => {
    if (!open || autoStarted.current || existing.isPending || existing.isError || existing.data) return;
    autoStarted.current = true;
    mutate();
  }, [open, existing.isPending, existing.isError, existing.data, mutate]);

  const report = existing.data ?? null;
  const busy = generate.isPending || (existing.isPending && open);

  function shareText(r: ShareReportResponse) {
    const headline = readinessHeadline(r.readiness) || `${r.stats.pct}% through ${r.title}`;
    return `${headline}\n${r.scout.line1}`;
  }

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" className="ai-border ai-glow relative gap-2">
            <AiSparkle /> <span className="ai-text font-semibold">Generate Readiness Report</span>
            {!seen && <AiBadge className="absolute -top-2 -right-2 shadow-sm" />}
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AiSparkle className="size-5" /> <span className="ai-text">Readiness Report</span>
              {report && <Badge variant={report.scout.ai ? "default" : "secondary"}>{report.scout.ai ? "AI" : "Built-in"}</Badge>}
            </DialogTitle>
            <DialogDescription>
              A shareable snapshot of {title}: company readiness, a scout report and your headline stats. Notes and stars stay private.
            </DialogDescription>
          </DialogHeader>

          {busy || !report ? (
            <div className="grid gap-2">
              <Skeleton className="aspect-[1200/630] w-full rounded-xl" />
              <p className="flex items-center gap-2 text-xs text-muted-foreground">
                {generate.isError || existing.isError ? "Couldn't load the report. Try again." : (<><Loader2 className="size-3.5 animate-spin" /> Scouting your progress…</>)}
              </p>
            </div>
          ) : (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element -- dynamic OG PNG */}
              <img src={imageUrl(report)} alt={`${report.title} readiness report`} width={1200} height={630} className="aspect-[1200/630] w-full rounded-xl border bg-muted" />
              <p className="truncate rounded-lg bg-muted px-3 py-2 font-mono text-xs" data-testid="share-link">/share/{report.slug}</p>
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => copy(shareUrl(report.slug), "Link copied")}><Link2 /> Copy link</Button>
                <Button variant="outline" asChild>
                  <a
                    href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText(report))}&url=${encodeURIComponent(shareUrl(report.slug))}`}
                    target="_blank"
                    rel="noreferrer noopener"
                  >
                    <XIcon /> Post on X
                  </a>
                </Button>
                <Button variant="outline" asChild>
                  <a href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl(report.slug))}`} target="_blank" rel="noreferrer noopener">
                    <LinkedInIcon /> LinkedIn
                  </a>
                </Button>
                <Button variant="outline" onClick={() => copy(shareUrl(report.slug), "Link copied for Discord", "Paste in Discord — the preview unfurls automatically.")}>
                  <MessageCircle /> Discord
                </Button>
                <Button variant="outline" asChild>
                  <a href={imageUrl(report)} download={`${report.slug}.png`}><Download /> PNG</a>
                </Button>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3">
                <Button variant="ghost" size="sm" onClick={() => generate.mutate()} disabled={generate.isPending}>
                  <RefreshCw /> Regenerate
                </Button>
                <Button variant="ghost" size="sm" className="text-destructive" onClick={() => setConfirmStop(true)}>
                  <Trash2 /> Stop sharing
                </Button>
              </div>
            </>
          )}
          {(generate.isError || existing.isError) && !busy && !report && (
            <Button onClick={() => generate.mutate()}><RefreshCw /> Try again</Button>
          )}
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={confirmStop}
        onOpenChange={setConfirmStop}
        title="Stop sharing this report?"
        description="The public link, preview image and clone link stop working immediately. Copies people already made stay theirs."
        confirmLabel="Stop sharing"
        icon={<Trash2 />}
        destructive
        pending={stop.isPending}
        onConfirm={() => stop.mutate()}
      />
    </>
  );
}
