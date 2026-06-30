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

export function filterReleasedEpisodes<
  T extends { air_date?: string | null },
>(rows: T[]): T[] {
  const today = todayYmdUtc();
  return rows.filter((row) => episodeAired(row.air_date, today));
}
