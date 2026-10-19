import { randomInt } from "node:crypto";

const ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";

/**
 * URL slug for a share link: kebab-cased title (≤ 40 chars) + 6 random characters. The random part is the
 * access token for cloning, so it comes from a CSPRNG. Lowercase only, to match the DB check `^[a-z0-9-]{3,64}$`.
 */
export function makeSlug(title: string, rand: (max: number) => number = randomInt): string {
  const base = title
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/g, "");
  const suffix = Array.from({ length: 6 }, () => ALPHABET[rand(ALPHABET.length)]).join("");
  return base ? `${base}-${suffix}` : `sprint-${suffix}`;
}
