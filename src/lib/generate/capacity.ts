import { addDays, format, parseISO } from "date-fns";
import { buildCalendar } from "@/lib/schedule";
import type { Difficulty } from "@/lib/types";
import type { DifficultyMix } from "./schema";
import { MAX_PER_DAY } from "./schema";

/** Rough solve time per problem, in minutes. Tunable. */
export const MINUTES: Record<Difficulty, number> = { Basic: 20, Core: 40, Pro: 60 };
export const UNKNOWN_MINUTES = 35;

export const minutesFor = (d: Difficulty | null) => (d ? MINUTES[d] : UNKNOWN_MINUTES);

export interface Capacity {
  /** Working (plan) days in the window. */
  workingDays: number;
  /** Minutes available per working day. */
  dailyMinutes: number;
  /** Plan days per sprint (one calendar week). */
  sprintLength: number;
  /** Total number of problems to aim for. */
  target: number;
  /** Last calendar day of the window (yyyy-MM-dd). */
  endDate: string;
  /** Rest days that fall inside the window. */
  restDays: string[];
}

/** Average minutes per problem for a difficulty mix (normalised; falls back to an even mix). */
export function averageMinutes(mix: DifficultyMix) {
  const total = mix.basic + mix.core + mix.pro;
  if (total <= 0) return (MINUTES.Basic + MINUTES.Core + MINUTES.Pro) / 3;
  return (mix.basic * MINUTES.Basic + mix.core * MINUTES.Core + mix.pro * MINUTES.Pro) / total;
}

export function computeCapacity(opts: {
  startDate: string;
  weeks: number;
  hoursPerDay: number;
  skipWeekends: boolean;
  restDays: string[];
  mix: DifficultyMix;
}): Capacity {
  const endDate = format(addDays(parseISO(opts.startDate), opts.weeks * 7 - 1), "yyyy-MM-dd");
  const restDays = [...new Set(opts.restDays)].filter((d) => d >= opts.startDate && d <= endDate).sort();
  const cfg = { startDate: opts.startDate, skipWeekends: opts.skipWeekends, restDays };
  // Every calendar day in the window is at most one plan day, so weeks*7 is an upper bound.
  const calendar = buildCalendar(opts.weeks * 7, cfg) ?? [];
  const workingDays = Math.max(1, calendar.filter((d) => d <= endDate).length);
  const dailyMinutes = Math.round(opts.hoursPerDay * 60);
  const perDay = Math.min(MAX_PER_DAY, Math.max(1, Math.floor(dailyMinutes / averageMinutes(opts.mix))));
  return {
    workingDays,
    dailyMinutes,
    sprintLength: opts.skipWeekends ? 5 : 7,
    target: perDay * workingDays,
    endDate,
    restDays,
  };
}
