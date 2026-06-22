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

/** Short hero date, e.g. “Jun 17, 2026”. */
export function formatHeroDate(iso: string | null | undefined): string | null {
  if (iso == null || String(iso).trim().length < 10) return null;
  const ymd = String(iso).trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null;
  const [y, m, d] = ymd.split("-").map(Number);
  const rel = new Date(Date.UTC(y, m - 1, d));
  if (Number.isNaN(rel.getTime())) return null;
  return rel.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** Hero runtime label, e.g. “1h 42m”. */
export function formatHeroRuntime(runtimeSeconds: number | null | undefined): string | null {
  if (runtimeSeconds == null || runtimeSeconds <= 0) return null;
  const totalMin = Math.round(runtimeSeconds / 60);
  const hours = Math.floor(totalMin / 60);
  const mins = totalMin % 60;
  if (hours > 0 && mins > 0) return `${hours}h ${mins}m`;
  if (hours > 0) return `${hours}h`;
  return `${mins}m`;
}
