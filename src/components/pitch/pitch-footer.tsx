"use client";

import { Logo } from "@/components/logo";
import { ShieldCheck } from "lucide-react";

export function PitchFooter() {
  return (
    <footer className="border-t border-border/50 bg-card/40 py-12 text-xs text-muted-foreground backdrop-blur-md">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="flex flex-col gap-8 md:flex-row md:items-center md:justify-between">
          <div className="space-y-2">
            <Logo />
            <p className="max-w-sm text-xs leading-relaxed text-muted-foreground">
              The AI-augmented DSA sprint tracker. Turn static .xlsx spreadsheets into calendar-scheduled study sprints with Google Gemini 2.5 code review and upcoming Google Pay subscriptions.
            </p>
          </div>

          <div className="flex flex-wrap gap-12 sm:gap-16 lg:gap-20 text-xs">
            <div className="space-y-3">
              <span className="font-semibold text-foreground tracking-wide">Navigation</span>
              <ul className="space-y-2.5">
                <li><a href="#pain-points" className="transition-colors hover:text-foreground">Pain Points</a></li>
                <li><a href="#solution" className="transition-colors hover:text-foreground">The Solution</a></li>
                <li><a href="#interactive-demo" className="transition-colors hover:text-foreground">Interactive Demo</a></li>
                <li><a href="#pricing" className="transition-colors hover:text-foreground">Pricing & Google Pay (Coming Soon)</a></li>
              </ul>
            </div>

            <div className="space-y-3">
              <span className="font-semibold text-foreground tracking-wide">Architecture</span>
              <ul className="space-y-2.5">
                <li><span className="transition-colors hover:text-foreground/90">Next.js 16 (App Router)</span></li>
                <li><span className="transition-colors hover:text-foreground/90">React 19 & Tailwind CSS</span></li>
                <li><span className="transition-colors hover:text-foreground/90">Google Vertex AI (Gemini 2.5)</span></li>
                <li><span className="transition-colors hover:text-foreground/90">PostgreSQL 16 with RLS</span></li>
              </ul>
            </div>

            <div className="space-y-3">
              <span className="font-semibold text-foreground tracking-wide">Payments & Security</span>
              <ul className="space-y-2.5">
                <li className="flex items-center gap-1.5"><ShieldCheck className="size-3.5 text-basic shrink-0" /> <span>Google Pay 256-bit TLS (Coming Soon)</span></li>
                <li><span>Tokenized Transactions</span></li>
                <li><span>7-Day Refund Policy</span></li>
                <li><span>Firebase Auth SSO</span></li>
              </ul>
            </div>
          </div>
        </div>

        <div className="mt-8 border-t border-border/40 pt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between text-[11px]">
          <p>© {new Date().getFullYear()} Sprintboard. Built for engineers targeting top-tier tech offers.</p>
          <div className="flex items-center gap-4">
            <a href="#pricing" className="hover:text-foreground">Terms of Service</a>
            <a href="#pricing" className="hover:text-foreground">Privacy Policy</a>
            <a href="/app" className="font-semibold text-primary hover:underline">Launch App →</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
