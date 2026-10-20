"use client";

import { Logo } from "@/components/logo";

export function PitchFooter() {
  return (
    <footer className="border-t border-border/50 bg-card/40 py-10 text-xs text-muted-foreground backdrop-blur-md">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="space-y-2">
            <Logo />
            <p className="max-w-md text-xs leading-relaxed text-muted-foreground">
              The AI-augmented DSA sprint tracker. Turn static .xlsx spreadsheets into calendar-scheduled study sprints with Google Gemini 2.5 code review and upcoming Google Pay subscriptions.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-6 text-xs">
            <a href="#pricing" className="transition-colors hover:text-foreground">Terms of Service</a>
            <a href="#pricing" className="transition-colors hover:text-foreground">Privacy Policy</a>
            <a href="/app" className="font-semibold text-primary transition-colors hover:underline">Launch App →</a>
          </div>
        </div>

        <div className="mt-8 border-t border-border/40 pt-6 text-[11px] text-muted-foreground">
          <p>© {new Date().getFullYear()} Sprintboard. Built for engineers targeting top-tier tech offers.</p>
        </div>
      </div>
    </footer>
  );
}

