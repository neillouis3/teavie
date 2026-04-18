/** Human-readable release line for catalog cards (date-only ISO `YYYY-MM-DD`). */
export function formatReleasePhrase(iso: string | null | undefined): string {
  if (iso == null || String(iso).trim().length < 10) return "Date TBA";
  const ymd = String(iso).trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return "Date TBA";
  const [y, m, d] = ymd.split("-").map(Number);
  const relUtc = Date.UTC(y, m - 1, d);
  const rel = new Date(relUtc);
  if (Number.isNaN(rel.getTime())) return "Date TBA";

  const now = new Date();
  const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());

  const fmt = rel.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });

  if (relUtc > todayUtc) return `Releases ${fmt}`;
  if (relUtc < todayUtc) return `Released ${fmt}`;
  return `Out today · ${fmt}`;
}
