export type StreamQualityLabel = "cam" | "hd";

export function todayYmdUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

function parseYmd(value: unknown): string | null {
  const ymd = String(value ?? "").trim().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(ymd) ? ymd : null;
}

function daysSince(startYmd: string, endYmd: string): number {
  const start = new Date(`${startYmd}T12:00:00Z`).getTime();
  const end = new Date(`${endYmd}T12:00:00Z`).getTime();
  return Math.floor((end - start) / 86_400_000);
}

type TmdbReleaseEntry = {
  release_date?: string;
  type?: number;
};

type TmdbReleaseDatesPayload = {
  results?: {
    iso_3166_1?: string;
    release_dates?: TmdbReleaseEntry[];
  }[];
};

function collectReleaseDates(
  payload: unknown,
  types: number[],
  preferUs = true
): string[] {
  const results = (payload as TmdbReleaseDatesPayload)?.results;
  if (!Array.isArray(results)) return [];

  const ordered = preferUs
    ? [
        ...results.filter((row) => row?.iso_3166_1 === "US"),
        ...results.filter((row) => row?.iso_3166_1 !== "US"),
      ]
    : results;

  const dates: string[] = [];
  for (const region of ordered) {
    const rels = region?.release_dates;
    if (!Array.isArray(rels)) continue;
    for (const entry of rels) {
      if (!types.includes(entry?.type ?? -1)) continue;
      const ymd = parseYmd(entry?.release_date);
      if (ymd) dates.push(ymd);
    }
  }
  return dates;
}

function earliestYmd(dates: string[]): string | null {
  if (!dates.length) return null;
  return [...dates].sort()[0];
}

/**
 * Heuristic: CAM when a title is in its theatrical window without a digital/home release yet.
 * Falls back to HD for older titles missing digital metadata.
 */
export function inferMovieStreamQuality(
  releaseDates: unknown,
  fallbackReleaseDate?: string | null
): StreamQualityLabel {
  const today = todayYmdUtc();
  const theatrical =
    earliestYmd(collectReleaseDates(releaseDates, [2, 3])) ??
    parseYmd(fallbackReleaseDate);
  const digital = earliestYmd(collectReleaseDates(releaseDates, [4, 5]));

  if (!theatrical || theatrical > today) return "hd";
  if (digital && digital <= today) return "hd";
  if (!digital && daysSince(theatrical, today) > 90) return "hd";
  return "cam";
}
