import type { DigestFacts } from "@/lib/types";
import { MAX_HEADLINE, MAX_LINE, MAX_LINES, type DigestCopy } from "./schema";

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
const clip = (s: string, max: number) => (s.length <= max ? s : `${s.slice(0, max - 1).trimEnd()}…`);
const you = (f: DigestFacts, userId: string, name: string) => (userId === f.me.userId ? "You" : name);

/** Built-in digest wording from the facts alone (AI off, model failure, or a quiet week). */
export function templateDigest(f: DigestFacts): DigestCopy {
  const lines: string[] = [];

  const top = f.weekly[0];
  const headline = f.cleared[0]
    ? `${you(f, f.cleared[0].userId, f.cleared[0].name)} cleared Sprint ${f.cleared[0].sprintNo}!`
    : f.weekSolves > 0
      ? `${f.groupName} solved ${plural(f.weekSolves, "problem")} this week`
      : `A quiet week in ${f.groupName}`;

  if (top) {
    const rest = f.weekly.slice(1).map((w) => `${you(f, w.userId, w.name)} (${w.solves})`);
    lines.push(
      `${you(f, top.userId, top.name)} led the week with ${plural(top.solves, "solve")}` +
        (top.streak > 1 ? ` and a ${top.streak}-day streak` : "") +
        (rest.length ? `, followed by ${rest.join(" and ")}.` : "."),
    );
  }

  for (const c of f.cleared.slice(1, 2)) lines.push(`${you(f, c.userId, c.name)} also cleared Sprint ${c.sprintNo}.`);

  const { overdue, ahead } = f.behind;
  if (overdue) {
    lines.push(`You have ${plural(overdue, "problem")} behind plan${ahead ? `; ${ahead.name} is ${ahead.by} ahead of you overall` : ""}.`);
  } else if (ahead) {
    lines.push(`${ahead.name} is ${plural(ahead.by, "problem")} ahead of you. One good session closes the gap.`);
  } else if (overdue === 0) {
    lines.push("You're on plan. Keep it rolling.");
  }

  const pair = f.pairUp[0];
  if (pair) lines.push(`${pair.partner.name} already solved ${pair.problem.name}. Ask them how they approached it.`);

  if (lines.length < 2) {
    lines.push(f.weekSolves > 0 ? "Every solve counts. Keep the streaks alive." : "One problem today gets everyone moving again.");
  }

  return { headline: clip(headline, MAX_HEADLINE), lines: lines.slice(0, MAX_LINES).map((l) => clip(l, MAX_LINE)) };
}
