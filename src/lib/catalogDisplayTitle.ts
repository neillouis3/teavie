/** True when a title is effectively shout-case (e.g. TMDB `JUJUTSU KAISEN`). */
function isMostlyUppercaseTitle(value: string): boolean {
  const letters = value.match(/[a-zA-Z]/g);
  if (!letters || letters.length < 3) return false;
  const upper = letters.filter((c) => c === c.toUpperCase()).length;
  return upper / letters.length >= 0.85;
}

/** Show catalog titles in normal casing without forcing CSS uppercase. */
export function catalogDisplayTitle(title: string | null | undefined): string {
  const raw = String(title ?? "").trim();
  if (!raw || !isMostlyUppercaseTitle(raw)) return raw;

  return raw
    .toLowerCase()
    .replace(/(^|[\s\-–—:/([{"'«]+)([a-z])/g, (_, prefix, char) => prefix + char.toUpperCase());
}
