"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

const FAQS = [
  {
    q: "How will Google Pay subscriptions work once launched?",
    a: "Sprintboard is integrating 1-click Google Pay checkout for our upcoming Pro tier. When launched, you will be able to authorize the subscription using your existing Google account and Google Wallet with tokenized security. You will be able to pause or cancel anytime with one click directly in your account settings.",
  },
  {
    q: "Why are AI tools moved to the Pro subscription?",
    a: "Running Google Gemini 2.5 Flash and Google Vertex AI reasoning with strict JSON schema enforcement requires substantial GPU and API compute. To keep the core sheet tracking free forever for every developer, we moved the AI code complexity review, smart backlog coach, goal-driven sprint generator, and active recall viva into the Pro tier.",
  },
  {
    q: "Can I import any custom .xlsx spreadsheet or DSA sheet?",
    a: "Yes! Sprintboard handles Striver SDE sheet, NeetCode 150, Blind 75, Love Babbar 450, or your college's custom Excel sheet. The parser automatically detects column names (Name, URL, Difficulty, Topic, Company) and preserves embedded hyperlinks.",
  },
  {
    q: "What happens when I fall behind on my schedule?",
    a: "That's why we built Sprintboard! Instead of abandoning your sheet, the Smart Reschedule Coach evaluates overdue problems and redistributes them across upcoming days or compresses them into open slots without pushing back your target completion date.",
  },
  {
    q: "Is there a free trial or money-back guarantee?",
    a: "Yes. You can use the Free Starter tier for as long as you want without a credit card. When upgrading to Pro once Google Pay launches, you will also be protected by our 7-day risk-free money-back guarantee.",
  },
];

export function FaqSection() {
  const [openIdx, setOpenIdx] = useState<number | null>(0);

  return (
    <section id="faq" className="relative border-t border-border/50 py-20 md:py-28">
      <div className="mx-auto max-w-4xl px-4 sm:px-6">
        <div className="text-center">
          <span className="rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary uppercase tracking-wider">
            Common Questions
          </span>
          <h2 className="mt-4 text-3xl font-bold tracking-tight sm:text-5xl">
            Frequently Asked Questions
          </h2>
          <p className="mt-4 text-base text-muted-foreground">
            Everything you need to know about Sprintboard, Gemini 2.5 AI, and the upcoming Google Pay Pro tier.
          </p>
        </div>

        <div className="mt-12 space-y-3">
          {FAQS.map((faq, i) => {
            const isOpen = openIdx === i;
            return (
              <div
                key={faq.q}
                className="overflow-hidden rounded-2xl border border-border/70 bg-card/60 backdrop-blur-md transition-colors"
              >
                <button
                  type="button"
                  onClick={() => setOpenIdx(isOpen ? null : i)}
                  className="flex w-full items-center justify-between p-5 text-left text-sm font-semibold text-foreground hover:text-primary transition-colors"
                >
                  <span>{faq.q}</span>
                  <ChevronDown
                    className={`size-4 shrink-0 transition-transform text-muted-foreground ${
                      isOpen ? "rotate-180 text-primary" : ""
                    }`}
                  />
                </button>
                {isOpen && (
                  <div className="border-t border-border/40 px-5 pt-3 pb-5 text-xs sm:text-sm leading-relaxed text-muted-foreground">
                    {faq.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
