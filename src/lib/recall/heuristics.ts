import { proseOf, statedComplexity, stripReview } from "@/lib/review/blocks";
import type { Recall, RecallProblem, Viva } from "./schema";
import { agoLabel, theorySubject, type TheorySubject } from "./select";

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const clip = (s: string, max: number) => (s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s);

/** The first real sentence of the user's prose (skipping headings, empty template lines and "Time:"/"Space:"). */
export function keySentence(notes: string): string | null {
  const prose = proseOf(stripReview(notes));
  for (const raw of prose.split("\n")) {
    const line = raw
      .replace(/^\s*(?:#+|[-*+]|\d+[.)]|>)\s*/, "")
      .replace(/[*_`]/g, "")
      .trim();
    if (line.length < 12) continue;
    if (/^(time|space)\b[^:]*:/i.test(line)) continue;
    if (/^(approach|intuition|notes?|solution)\s*:?\s*$/i.test(line)) continue;
    const sentence = /^(.+?[.!?])(?:\s|$)/.exec(line)?.[1] ?? line;
    return clip(sentence, 160);
  }
  return null;
}

/** Offline recall question built from the user's notes (or the topics when they wrote nothing). */
export function heuristicRecall(problem: RecallProblem, notes: string, daysAgo: number): Recall {
  const when = capitalize(agoLabel(daysAgo));
  const sentence = keySentence(notes);
  const stated = statedComplexity(stripReview(notes));
  const topic = problem.topics[0];

  if (sentence) {
    const complexity = stated.time
      ? `You noted time ${stated.time}${stated.space ? ` and space ${stated.space}` : ""}.`
      : "Check whether you wrote down the complexity; if not, add it to your notes.";
    return {
      intro: `${when} you solved ${problem.name}. In your notes you wrote: “${sentence}”`,
      question: "Without looking: what is the time complexity of that approach, and which idea or data structure makes it possible?",
      hint: topic ? `Think about how ${topic} is used here.` : "Think about what you store and how each step stays cheap.",
      answer: `${complexity} Open your notes to compare the key idea with your answer.`,
    };
  }
  return {
    intro: `${when} you solved ${problem.name}${topic ? ` (${problem.topics.slice(0, 2).join(", ")})` : ""}. You didn't leave notes, so let's rebuild it.`,
    question: "In two sentences: what was the core idea of your solution, and what was its time complexity?",
    hint: topic ? `It's tagged ${topic}. What does that pattern usually buy you?` : "Start from the brute force, then say what you optimised.",
    answer: "Re-open the problem and compare. Then write a one-line takeaway in your notes so next time's question can be sharper.",
  };
}

type Template = (t: string) => Viva["questions"][number];

const VIVA_BANK: Record<TheorySubject, [Template, Template]> = {
  dbms: [
    (t) => ({ question: `Explain ${t} in one line, as you would to an interviewer. Why does a database need it?`, answer: `A crisp definition of ${t} plus the problem it solves (consistency, redundancy, performance or concurrency).` }),
    (t) => ({ question: `Give a concrete example (a table, query or transaction) where getting ${t} wrong causes a bug or anomaly.`, answer: `A small schema or transaction that shows the failure (e.g. an update anomaly, a lost update or a slow full scan) and how ${t} prevents it.` }),
  ],
  oops: [
    (t) => ({ question: `Define ${t} and name the OOP principle it supports.`, answer: `A one-line definition of ${t} and the principle it serves (encapsulation, abstraction, inheritance or polymorphism).` }),
    (t) => ({ question: `Show where ${t} appears in real code (e.g. Java/C++): what would break or get messier without it?`, answer: `A short class example using ${t}, and the coupling or duplication you would get without it.` }),
  ],
  os: [
    (t) => ({ question: `What problem does ${t} solve for the operating system, in one or two sentences?`, answer: `The resource being managed (CPU, memory, I/O or synchronisation) and how ${t} manages it.` }),
    (t) => ({ question: `Describe a scenario where ${t} goes wrong or is costly (e.g. starvation, deadlock, thrashing). How is it mitigated?`, answer: `A concrete failure mode of ${t} and a standard fix or trade-off.` }),
  ],
  cn: [
    (t) => ({ question: `Which layer does ${t} belong to, and what job does it do there?`, answer: `The OSI/TCP-IP layer of ${t} and its responsibility (addressing, reliability, routing, naming...).` }),
    (t) => ({ question: `Walk through what happens with ${t} when you open a website. What fails if it's missing?`, answer: `The step-by-step role of ${t} in a real request and the user-visible failure without it.` }),
  ],
};

/** Offline 2-question viva for a theory topic (DBMS/OOPS/OS/CN). */
export function heuristicViva(problem: RecallProblem): Viva {
  const subject = theorySubject(problem.subject) ?? "dbms";
  const topic = clip(problem.name.trim() || problem.topics[0] || "this topic", 80);
  const [a, b] = VIVA_BANK[subject];
  return { questions: [a(topic), b(topic)] };
}
