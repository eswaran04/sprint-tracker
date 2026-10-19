import { Brain, CalendarSync, Code2, FileSpreadsheet, MessageSquareText, Newspaper, type LucideIcon } from "lucide-react";

export interface TourStep {
  id: string;
  badge: string;
  title: string;
  tagline: string;
  description: string;
  icon: LucideIcon;
  gradient: string;
  actionLabel: string;
  getHref: (sprintId?: string, groupId?: string) => string;
  features: string[];
  previewType: "generator" | "search" | "reschedule" | "warmup" | "review" | "digest";
}

export const AI_TOUR_STEPS: TourStep[] = [
  {
    id: "generator",
    badge: "Sheet Generator",
    title: "Generate a Custom Sheet",
    tagline: "Tailored DSA sprint for your target company & timeline",
    description:
      "Tell Gemini your goal—like 'Targeting Google in 6 weeks with weak DP & graphs'. It selects the most relevant problems from curated lists (LeetCode 75, Striver A2Z, NeetCode) and structures them into a balanced day-by-day roadmap.",
    icon: FileSpreadsheet,
    gradient: "from-blue-500/20 via-indigo-500/10 to-transparent",
    actionLabel: "Try Generator",
    getHref: () => "/app/import",
    features: [
      "Company-targeted problem selection",
      "Automatic day-by-day difficulty progression",
      "Incorporates your focus topics & weak areas",
    ],
    previewType: "generator",
  },
  {
    id: "search",
    badge: "Plain Words Search",
    title: "Ask in Plain Words",
    tagline: "Natural language search across all your problems",
    description:
      "Ditch endless filters and dropdowns. Search how you think: 'Show me hard tree questions from Meta I haven't solved' or '2D dynamic programming'. AI parses your intent and configures the exact difficulty, topic, and status filters instantly.",
    icon: MessageSquareText,
    gradient: "from-violet-500/20 via-purple-500/10 to-transparent",
    actionLabel: "Try AI Search",
    getHref: (sprintId) => (sprintId ? `/app/s/${sprintId}?ai=search` : "/app"),
    features: [
      "Translates natural queries into complex multi-tag filters",
      "Understands company, topic, difficulty & status constraints",
      "Available via ⌘K or the sidebar anytime",
    ],
    previewType: "search",
  },
  {
    id: "reschedule",
    badge: "Smart Reschedule",
    title: "Smart Reschedule",
    tagline: "Keep your momentum when life interrupts",
    description:
      "Fell behind on your sprint? Don't stress or give up your streak. Smart reschedule analyzes your backlog and redistributes overdue problems across remaining days without overloading you or blowing up your target finish date.",
    icon: CalendarSync,
    gradient: "from-fuchsia-500/20 via-pink-500/10 to-transparent",
    actionLabel: "Try Reschedule",
    getHref: (sprintId) => (sprintId ? `/app/s/${sprintId}?ai=reschedule` : "/app"),
    features: [
      "Smoothly spreads overdue backlog across remaining days",
      "Preserves rest days and daily problem caps",
      "Diff preview before applying changes",
    ],
    previewType: "reschedule",
  },
  {
    id: "warmup",
    badge: "Daily Recall",
    title: "5-Min Warmup",
    tagline: "Prime your brain with conceptual recall before coding",
    description:
      "Warm up your problem-solving muscles with quick conceptual checks. Test invariants, time/space trade-offs, and edge cases before writing code, helping you avoid common traps during actual interviews.",
    icon: Brain,
    gradient: "from-pink-500/20 via-rose-500/10 to-transparent",
    actionLabel: "Try Warmup",
    getHref: (sprintId) => (sprintId ? `/app/s/${sprintId}?ai=warmup` : "/app"),
    features: [
      "Rapid-fire viva questions on data structures & algorithms",
      "Targeted concept checks on today's scheduled topics",
      "Instant explanations with time & space trade-offs",
    ],
    previewType: "warmup",
  },
  {
    id: "review",
    badge: "Code Review",
    title: "Code & Intuition Review",
    tagline: "Gemini-powered critique on your solution approach",
    description:
      "Type your approach, intuition, or code into problem notes. Gemini gives you constructive feedback: verifying time and space complexities, warning about sneaky edge cases, and suggesting clean idiomatic optimizations.",
    icon: Code2,
    gradient: "from-purple-500/20 via-blue-500/10 to-transparent",
    actionLabel: "Try Review",
    getHref: (sprintId) => (sprintId ? `/app/s/${sprintId}?ai=review` : "/app"),
    features: [
      "Rigorous asymptotic Big-O analysis verification",
      "Discovers boundary conditions and tricky edge cases",
      "Actionable hints without spoiling optimal solutions",
    ],
    previewType: "review",
  },
  {
    id: "digest",
    badge: "Study Groups",
    title: "Weekly Group Digest",
    tagline: "AI peer progress summaries, milestones & pair-up recommendations",
    description:
      "Stay accountable and motivated with your study squad. Gemini analyzes weekly group activity, celebrates cleared milestones, and suggests peer pair-ups so you can practice tricky problems with teammates who already conquered them.",
    icon: Newspaper,
    gradient: "from-amber-500/20 via-orange-500/10 to-transparent",
    actionLabel: "View Digest",
    getHref: (_sprintId, groupId) => (groupId ? `/app/groups/${groupId}#weekly-digest` : "/app"),
    features: [
      "Celebrates weekly solve leaders and completed sprint milestones",
      "Suggests smart peer pair-ups for problems due on your plan",
      "Personalized standing insights and lightweight cheer nudges",
    ],
    previewType: "digest",
  },
];
