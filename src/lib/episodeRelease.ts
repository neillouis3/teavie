export function todayYmdUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Episodes without a YYYY-MM-DD air date are treated as released. */
export function episodeAired(
  airDate: string | null | undefined,
  todayYmd = todayYmdUtc()
): boolean {
  const ad = String(airDate ?? "").trim();
  if (ad.length < 10) return true;
  return ad.slice(0, 10) <= todayYmd;
}

export function isEpisodeUpcoming(
  airDate: string | null | undefined,
  todayYmd = todayYmdUtc()
): boolean {
  const ad = String(airDate ?? "").trim();
  if (ad.length < 10) return false;
  return ad.slice(0, 10) > todayYmd;
}

export function filterReleasedEpisodes<
  T extends { air_date?: string | null },
>(rows: T[]): T[] {
  const today = todayYmdUtc();
  return rows.filter((row) => episodeAired(row.air_date, today));
}

export function formatEpisodeAirDate(
  airDate?: string | null
): string | null {
  const ad = String(airDate ?? "").trim();
  if (ad.length < 10) return null;
  try {
    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
    }).format(new Date(`${ad.slice(0, 10)}T12:00:00`));
  } catch {
    return ad.slice(0, 10);
  }
}
