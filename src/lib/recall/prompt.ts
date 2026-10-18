import { proseOf, extractBlocks, stripReview } from "@/lib/review/blocks";
import { formatSubject } from "@/lib/format";
import type { RecallProblem } from "./schema";
import { agoLabel } from "./select";

export const RECALL_SYSTEM = `You are a friendly interview coach running a 2-minute spaced-repetition warmup.
The student solved a problem some days ago and wrote notes. Ask ONE question that checks they still remember the
key insight. Reply with JSON only, matching the schema.

- intro: one or two sentences. Say when they solved it and the problem name, then paraphrase ONE specific idea from
  THEIR notes (e.g. "In your notes, you wrote about using a Doubly Linked List + HashMap."). If the notes are empty,
  mention the topics instead. Never invent things they "wrote".
- question: a single "why", "what breaks if" or complexity question about that idea, answerable in under a minute
  (e.g. "Why couldn't a singly linked list give O(1) deletion here?"). No multi-part questions, no coding tasks.
- hint: a short nudge that doesn't give the answer away.
- answer: the correct answer in 1-3 sentences.
Write complexities in plain Big-O, e.g. "O(1)", "O(n log n)".`;

export const VIVA_SYSTEM = `You are a technical interviewer running a rapid-fire viva on a CS fundamentals topic
(DBMS, OOP, Operating Systems or Computer Networks). The student just marked the topic as done.
Ask exactly 2 short questions that prove conceptual understanding of THIS topic, as an interviewer would:
the first a definition/why question, the second an applied or "what happens if" question. Reply with JSON only.
Each answer is 1-2 sentences, accurate and specific. If the student's notes are given, you may build on them.`;

/** The part of the notes worth showing the model: prose first, then a little code; no previous AI review. */
export function notesDigest(notes: string, max = 3000) {
  const clean = stripReview(notes);
  const prose = proseOf(clean);
  const code = extractBlocks(clean)
    .map((b) => b.lines.join("\n"))
    .join("\n\n");
  return [prose, code && `Code:\n${code}`].filter(Boolean).join("\n\n").slice(0, max);
}

function problemLines(problem: RecallProblem) {
  return [
    `Problem: ${problem.name}`,
    problem.subject ? `Subject: ${formatSubject(problem.subject)}` : null,
    problem.difficulty ? `Difficulty: ${problem.difficulty}` : null,
    `Topics: ${problem.topics.length ? problem.topics.join(", ") : "(none)"}`,
  ];
}

export function recallUser(problem: RecallProblem, notes: string, daysAgo: number) {
  const digest = notesDigest(notes);
  return [...problemLines(problem), `Solved: ${agoLabel(daysAgo)} (${daysAgo} days)`, "", "Student's notes:", digest || "(empty)"]
    .filter((l) => l !== null)
    .join("\n");
}

export function vivaUser(problem: RecallProblem, notes: string) {
  const digest = notesDigest(notes, 2000);
  return [...problemLines(problem), "", "Student's notes:", digest || "(empty)"].filter((l) => l !== null).join("\n");
}
