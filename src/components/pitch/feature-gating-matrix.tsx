"use client";

import { Check, Crown, Lock, Sparkles, X } from "lucide-react";

interface FeatureRow {
  name: string;
  category: string;
  free: boolean | string;
  pro: boolean | string;
  isAiGated?: boolean;
}

const FEATURES_TABLE: FeatureRow[] = [
  { name: ".xlsx Sheet Import (Striver, NeetCode, Custom)", category: "Core Sprints", free: "1 Active Sprint", pro: "Unlimited Sprints" },
  { name: "Calendar Pacing & Weekend Skipping", category: "Core Sprints", free: true, pro: true },
  { name: "Company, Topic, Difficulty Filtering", category: "Core Sprints", free: true, pro: true },
  { name: "Markdown Notes with Code Highlighting", category: "Core Sprints", free: true, pro: true },
  { name: "Public Sheet Catalog Browsing & Copying", category: "Core Sprints", free: true, pro: true },
  
  // Gated AI features moved to Pro Subscription
  { name: "Gemini 2.5 Code Review & Big-O Auditor", category: "AI Superpowers", free: false, pro: true, isAiGated: true },
  { name: "Smart Reschedule Coach (Backlog Balancer)", category: "AI Superpowers", free: false, pro: true, isAiGated: true },
  { name: "Goal-Driven Sprint Generator (Natural Language)", category: "AI Superpowers", free: false, pro: true, isAiGated: true },
  { name: "Active Recall Spaced-Repetition Oral Viva", category: "AI Superpowers", free: false, pro: true, isAiGated: true },
  { name: "Weekly Team Digest & Automated Peer Nudges", category: "AI Superpowers", free: false, pro: true, isAiGated: true },
  { name: "pgvector Semantic Search & Catalog Recommendations", category: "AI Superpowers", free: false, pro: true, isAiGated: true },
  
  { name: "Study Pods & Peer Activity Feed", category: "Collaboration", free: "Up to 3 members", pro: "Unlimited members" },
  { name: "Google Pay Subscription Integration", category: "Billing & Access", free: "Not needed", pro: "1-Click GPay (Coming Soon)" },
];

export function FeatureGatingMatrixSection() {
  return (
    <section id="feature-matrix" className="relative border-t border-border/50 py-20 md:py-28 bg-card/20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="mx-auto max-w-3xl text-center">
          <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider">
            Tier Breakdown
          </span>
          <h2 className="mt-4 text-3xl font-bold tracking-tight sm:text-5xl">
            Free Starter vs. Pro Sprint Subscription
          </h2>
          <p className="mt-4 text-base text-muted-foreground sm:text-lg">
            Essential sheet tracking remains 100% free forever. To sustain cutting-edge Google Vertex AI compute, we moved automated Gemini code reviews, smart backlog coaching, and oral viva into the Pro subscription.
          </p>
        </div>

        {/* Feature Table */}
        <div className="mx-auto mt-14 max-w-4xl overflow-hidden rounded-2xl border border-border/70 bg-card/90 shadow-xl backdrop-blur-md">
          <div className="grid grid-cols-12 border-b border-border/60 bg-muted/40 p-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">
            <div className="col-span-6 sm:col-span-7">Feature & Capability</div>
            <div className="col-span-3 sm:col-span-2 text-center">Free Starter</div>
            <div className="col-span-3 sm:col-span-3 text-center text-amber-500 flex items-center justify-center gap-1">
              <Crown className="size-3.5 fill-current" />
              <span>Pro Plan</span>
            </div>
          </div>

          <div className="divide-y divide-border/40">
            {FEATURES_TABLE.map((item) => (
              <div
                key={item.name}
                className="grid grid-cols-12 items-center p-4 text-xs transition-colors hover:bg-muted/30"
              >
                <div className="col-span-6 sm:col-span-7 pr-2">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground">{item.name}</span>
                    {item.isAiGated && (
                      <span className="hidden items-center gap-1 rounded-full bg-gradient-to-r from-primary/15 via-chart-5/15 to-transparent px-2 py-0.5 text-[10px] font-semibold text-primary sm:inline-flex">
                        <Sparkles className="size-2.5" /> AI Gated
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-muted-foreground">{item.category}</span>
                </div>

                {/* Free Column */}
                <div className="col-span-3 sm:col-span-2 flex items-center justify-center text-center">
                  {typeof item.free === "string" ? (
                    <span className="font-medium text-muted-foreground">{item.free}</span>
                  ) : item.free ? (
                    <span className="flex size-5 items-center justify-center rounded-full bg-basic/20 text-basic">
                      <Check className="size-3 stroke-[2.5]" />
                    </span>
                  ) : (
                    <span className="flex size-5 items-center justify-center rounded-full bg-muted text-muted-foreground/60">
                      <Lock className="size-3" />
                    </span>
                  )}
                </div>

                {/* Pro Column */}
                <div className="col-span-3 sm:col-span-3 flex items-center justify-center text-center">
                  {typeof item.pro === "string" ? (
                    <span className="font-semibold text-foreground">{item.pro}</span>
                  ) : item.pro ? (
                    <span className="flex items-center gap-1 font-semibold text-basic">
                      <span className="flex size-5 items-center justify-center rounded-full bg-basic text-primary-foreground">
                        <Check className="size-3 stroke-[3]" />
                      </span>
                      <span className="hidden sm:inline text-[11px]">Included</span>
                    </span>
                  ) : (
                    <X className="size-4 text-muted-foreground" />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
