export type TmdbVideo = {
  key: string;
  site: string;
  type: string;
  official?: boolean;
  published_at?: string;
  name?: string;
};

export type TmdbVideosPayload = {
  results?: TmdbVideo[];
};

const TRAILER_TYPES = new Set(["Trailer", "Teaser"]);

/** Best YouTube trailer/teaser embed URL for a TMDB `videos` payload. */
export function pickYoutubeTrailerEmbedUrl(
  videos: TmdbVideosPayload | null | undefined
): string | null {
  const results = videos?.results;
  if (!Array.isArray(results)) return null;

  const candidates = results.filter(
    (video) =>
      video.site === "YouTube" &&
      typeof video.key === "string" &&
      video.key.trim().length > 0 &&
      TRAILER_TYPES.has(video.type)
  );
  if (candidates.length === 0) return null;

  candidates.sort((a, b) => {
    if (Boolean(b.official) !== Boolean(a.official)) {
      return b.official ? 1 : -1;
    }
    if (a.type !== b.type) {
      if (a.type === "Trailer") return -1;
      if (b.type === "Trailer") return 1;
    }
    return String(b.published_at ?? "").localeCompare(String(a.published_at ?? ""));
  });

  const key = candidates[0].key.trim();
  return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(key)}?rel=0&modestbranding=1`;
}
