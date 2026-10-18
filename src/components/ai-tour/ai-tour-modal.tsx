"use client";

import { AnimatePresence, motion, type Variants } from "motion/react";
import { ArrowLeft, ArrowRight, Check, ExternalLink, Sparkles, X } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useId } from "react";
import { AiBadge, AiSparkle } from "@/components/ui/ai-badge";
import { Button } from "@/components/ui/button";
import { useSprints } from "@/hooks/use-sprints";
import { useMyGroups } from "@/hooks/use-groups";
import {
  closeAiTour,
  hasSeenAiTour,
  nextAiTourStep,
  openAiTour,
  prevAiTourStep,
  setAiTourStep,
  useAiTourState,
} from "@/lib/ai-tour-store";
import { markFeatureSeen, type AiFeature } from "@/hooks/use-feature-seen";
import { cn } from "@/lib/utils";
import { AI_TOUR_STEPS } from "./ai-tour-data";
import { TourPreview } from "./ai-tour-preview";

const STEP_FEATURE_MAP: Record<string, AiFeature> = {
  generator: "sheet-generator",
  search: "ai-search",
  reschedule: "smart-reschedule",
  warmup: "daily-warmup",
  review: "code-review",
  digest: "group-digest",
};

const slideVariants: Variants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 32 : -32,
    opacity: 0,
    scale: 0.98,
  }),
  center: {
    x: 0,
    opacity: 1,
    scale: 1,
    transition: {
      x: { type: "spring", stiffness: 340, damping: 32 },
      opacity: { duration: 0.22 },
      scale: { duration: 0.22 },
    },
  },
  exit: (direction: number) => ({
    x: direction < 0 ? 32 : -32,
    opacity: 0,
    scale: 0.98,
    transition: {
      x: { type: "spring", stiffness: 340, damping: 32 },
      opacity: { duration: 0.18 },
      scale: { duration: 0.18 },
    },
  }),
};

export function AiTourModal() {
  const { isOpen, step, direction } = useAiTourState();
  const { data: sprints } = useSprints();
  const { data: groups } = useMyGroups();
  const path = usePathname();
  const router = useRouter();
  const titleId = useId();

  // Pick the sprint that is currently open, or the first sprint
  const activeSprintId = sprints?.find((s) => path.startsWith(`/app/s/${s.id}`))?.id ?? sprints?.[0]?.id;
  const activeGroupId =
    groups?.find((g) => path.startsWith(`/app/groups/${g.id}`))?.id ??
    groups?.find((g) => g.sprint_id === activeSprintId)?.id ??
    groups?.[0]?.id;

  // Auto-launch the tour for first-time visitors after a brief delay
  useEffect(() => {
    if (!hasSeenAiTour()) {
      const timer = setTimeout(() => {
        openAiTour(0);
      }, 700);
      return () => clearTimeout(timer);
    }
  }, []);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        closeAiTour();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        nextAiTourStep();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        prevAiTourStep();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  const currentStepData = AI_TOUR_STEPS[step] ?? AI_TOUR_STEPS[0];
  const isLastStep = step === AI_TOUR_STEPS.length - 1;
  const StepIcon = currentStepData.icon;

  const handleTryNow = () => {
    const feature = STEP_FEATURE_MAP[currentStepData.id];
    if (feature) markFeatureSeen(feature);
    const href = currentStepData.getHref(activeSprintId, activeGroupId);
    closeAiTour();
    router.push(href);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5"
        >
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={closeAiTour}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
          />

          {/* Modal Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 16 }}
            transition={{ type: "spring", stiffness: 350, damping: 30 }}
            className={cn(
              "relative z-10 flex flex-col w-full max-w-xl max-h-[92vh] overflow-hidden rounded-2xl border bg-card text-card-foreground shadow-2xl",
              "border-[var(--ai-2)]/30 ai-glow",
            )}
          >
            {/* Top Header Bar */}
            <div className="flex items-center justify-between border-b px-5 py-3.5 bg-muted/30">
              <div className="flex items-center gap-2">
                <span className="flex size-7 items-center justify-center rounded-lg bg-[var(--ai-2)]/15 text-[var(--ai-2)]">
                  <AiSparkle className="size-4" />
                </span>
                <span className="text-xs font-semibold tracking-wider uppercase ai-text">
                  New AI Features
                </span>
                <AiBadge label="Gemini 2.5" />
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-muted-foreground tabular-nums">
                  {step + 1} / {AI_TOUR_STEPS.length}
                </span>
                <button
                  type="button"
                  onClick={closeAiTour}
                  className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                  aria-label="Close tour"
                >
                  <X className="size-4" />
                </button>
              </div>
            </div>

            {/* Step Body with Animated Slide Transitions */}
            <div className="relative flex-1 overflow-y-auto p-5 sm:p-6">
              <AnimatePresence mode="popLayout" custom={direction}>
                <motion.div
                  key={step}
                  custom={direction}
                  variants={slideVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  className="flex flex-col gap-5"
                >
                  {/* Step Header */}
                  <div className="flex items-start gap-3.5">
                    <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--ai-1)]/20 via-[var(--ai-2)]/20 to-[var(--ai-3)]/20 border border-[var(--ai-2)]/30 text-[var(--ai-2)] shadow-sm">
                      <StepIcon className="size-5.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h2 id={titleId} className="text-lg font-bold tracking-tight">
                          {currentStepData.title}
                        </h2>
                        <span className="rounded-full bg-[var(--ai-2)]/10 px-2 py-0.5 text-[10px] font-medium text-[var(--ai-2)] border border-[var(--ai-2)]/25">
                          {currentStepData.badge}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground font-medium">
                        {currentStepData.tagline}
                      </p>
                    </div>
                  </div>

                  {/* Step Description */}
                  <p className="text-sm text-foreground/85 leading-relaxed">
                    {currentStepData.description}
                  </p>

                  {/* Visual Preview Card */}
                  <TourPreview type={currentStepData.previewType} />

                  {/* Key Highlights */}
                  <div className="space-y-1.5 pt-1">
                    <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                      Highlights
                    </span>
                    <ul className="space-y-1.5">
                      {currentStepData.features.map((feat, i) => (
                        <li key={i} className="flex items-center gap-2 text-xs text-foreground/90">
                          <span className="flex size-4 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                            <Check className="size-2.5 stroke-[2.5]" />
                          </span>
                          <span>{feat}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Bottom Navigation & Controls */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t bg-muted/20 px-5 py-3.5">
              {/* Step indicator pills */}
              <div className="flex items-center gap-1.5">
                {AI_TOUR_STEPS.map((s, idx) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setAiTourStep(idx)}
                    aria-label={`Go to step ${idx + 1}: ${s.title}`}
                    className={cn(
                      "h-2 rounded-full transition-all duration-300",
                      idx === step
                        ? "w-6 bg-gradient-to-r from-[var(--ai-1)] to-[var(--ai-3)] shadow-xs"
                        : "w-2 bg-muted-foreground/30 hover:bg-muted-foreground/60",
                    )}
                  />
                ))}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 ml-auto">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={closeAiTour}
                  className="text-muted-foreground hover:text-foreground"
                >
                  Skip tour
                </Button>

                {step > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={prevAiTourStep}
                    className="gap-1"
                  >
                    <ArrowLeft className="size-3.5" /> Back
                  </Button>
                )}

                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleTryNow}
                  className="gap-1 border-[var(--ai-2)]/30 text-[var(--ai-2)] hover:bg-[var(--ai-2)]/10"
                >
                  <span>{currentStepData.actionLabel}</span>
                  <ExternalLink className="size-3" />
                </Button>

                <Button
                  size="sm"
                  onClick={nextAiTourStep}
                  className={cn(
                    "gap-1 font-semibold shadow-xs text-white",
                    "ai-fill hover:opacity-90 transition-opacity",
                  )}
                >
                  {isLastStep ? (
                    <>
                      <span>Finish</span>
                      <Sparkles className="size-3.5" />
                    </>
                  ) : (
                    <>
                      <span>Next</span>
                      <ArrowRight className="size-3.5" />
                    </>
                  )}
                </Button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
