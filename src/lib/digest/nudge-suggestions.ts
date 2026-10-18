export const MAX_NUDGE = 140;

const clip = (s: string) => (s.length <= MAX_NUDGE ? s : `${s.slice(0, MAX_NUDGE - 1).trimEnd()}…`);
const first = (name: string) => name.trim().split(/\s+/)[0] || name;

/**
 * Up to 3 ready-made nudge messages for a teammate (each ≤ 140 chars). Pure templates: no AI, no network.
 * `problem` is one they solved that you haven't (from the digest's pair-ups), if any.
 */
export function nudgeSuggestions(peer: { name: string; streak?: number; doneToday?: number }, problem?: string | null): string[] {
  const who = first(peer.name);
  const out: string[] = [];
  if (problem) out.push(`Hey ${who}, you cracked ${problem}. Walk me through it later?`);
  if (peer.streak && peer.streak > 1 && !peer.doneToday) out.push(`Don't break that ${peer.streak}-day streak, ${who}! One problem today?`);
  out.push(`One problem today, ${who}? I'm doing mine now.`);
  out.push(`Missing you on the leaderboard, ${who}. Let's go!`);
  return [...new Set(out.map(clip))].slice(0, 3);
}
