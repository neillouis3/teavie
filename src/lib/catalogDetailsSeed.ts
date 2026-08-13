/**
 * Card → modal instant paint: embed minimal catalog fields on detail links.
 */

export type CatalogDetailsSeed = {
  title: string;
  posterPath?: string;
  backdropPath?: string;
  overview?: string;
  /** ISO date when known (release_date / first_air_date). */
  releaseDate?: string;
  year?: string;
  voteAverage?: number;
};

export type CatalogSeedFallback = {
  title?: string;
  release_date?: string;
  overview?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  vote_average?: number;
  imdb_genres?: string[];
  omdb?: { genre?: string | null };
};

export const CATALOG_SEED_ATTR = "data-catalog-seed";

export function buildCatalogDetailsSeed(props: {
  title: string;
  posterPath?: string | null;
  backdropPath?: string | null;
  overview?: string | null;
  releaseDate?: string | null;
  year?: string | null;
  voteAverage?: number | null;
}): CatalogDetailsSeed {
  const year = String(props.year ?? "").trim();
  const releaseDate = String(props.releaseDate ?? "").trim();
  return {
    title: String(props.title ?? "").trim(),
    ...(props.posterPath?.trim() ? { posterPath: props.posterPath.trim() } : {}),
    ...(props.backdropPath?.trim() ? { backdropPath: props.backdropPath.trim() } : {}),
    ...(props.overview?.trim() ? { overview: props.overview.trim() } : {}),
    ...(releaseDate.length >= 4 ? { releaseDate: releaseDate.slice(0, 10) } : {}),
    ...(year && year !== "N/A" ? { year } : {}),
    ...(typeof props.voteAverage === "number" &&
    Number.isFinite(props.voteAverage) &&
    props.voteAverage > 0
      ? { voteAverage: props.voteAverage }
      : {}),
  };
}

export function serializeCatalogSeed(seed: CatalogDetailsSeed): string {
  const compact = Object.fromEntries(
    Object.entries(seed).filter(
      ([, value]) => value != null && String(value).trim() !== ""
    )
  );
  return encodeURIComponent(JSON.stringify(compact));
}

export function parseCatalogSeed(
  raw: string | null | undefined
): CatalogDetailsSeed | null {
  if (!raw?.trim()) return null;
  try {
    const parsed = JSON.parse(decodeURIComponent(raw.trim())) as CatalogDetailsSeed;
    if (!parsed || typeof parsed.title !== "string" || !parsed.title.trim()) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function catalogSeedLinkProps(seed: CatalogDetailsSeed): {
  "data-catalog-seed": string;
} {
  return { [CATALOG_SEED_ATTR]: serializeCatalogSeed(seed) };
}

export function seedBannerPath(seed: CatalogDetailsSeed | null | undefined): string | null {
  if (!seed) return null;
  return seed.backdropPath?.trim() || seed.posterPath?.trim() || null;
}

function isPlaceholderReleaseDate(value: string | null | undefined): boolean {
  const d = String(value ?? "").trim().slice(0, 10);
  return /^\d{4}-01-01$/.test(d);
}

function pickReleaseDate(
  incoming: string | undefined,
  prev: string | undefined,
  seed: CatalogDetailsSeed | null | undefined,
  fallback: CatalogSeedFallback | null | undefined
): string {
  const fromIncoming = String(incoming ?? "").trim();
  if (fromIncoming && !isPlaceholderReleaseDate(fromIncoming)) return fromIncoming.slice(0, 10);

  const fromFallback = String(fallback?.release_date ?? "").trim();
  if (fromFallback && !isPlaceholderReleaseDate(fromFallback)) return fromFallback.slice(0, 10);

  const fromSeed = String(seed?.releaseDate ?? "").trim();
  if (fromSeed.length >= 10 && !isPlaceholderReleaseDate(fromSeed)) return fromSeed.slice(0, 10);

  const fromPrev = String(prev ?? "").trim();
  if (fromPrev && !isPlaceholderReleaseDate(fromPrev)) return fromPrev.slice(0, 10);

  return "";
}

function pickOverview(
  incoming: string | undefined,
  prev: string | undefined,
  seed: CatalogDetailsSeed | null | undefined,
  fallback: CatalogSeedFallback | null | undefined
): string {
  const fromIncoming = String(incoming ?? "").trim();
  if (fromIncoming) return fromIncoming;
  const fromPrev = String(prev ?? "").trim();
  if (fromPrev) return fromPrev;
  const fromFallback = String(fallback?.overview ?? "").trim();
  if (fromFallback) return fromFallback;
  return String(seed?.overview ?? "").trim();
}

/** Keep the card hero image stable while TMDB details load in the modal. */
export function preserveSeedBackdrop<
  T extends { backdrop_path?: string | null; poster_path?: string | null },
>(doc: T, seed: CatalogDetailsSeed | null | undefined): T {
  const path = seedBannerPath(seed);
  if (!path) return doc;
  return { ...doc, backdrop_path: path };
}

/** Merge modal fetch results without wiping card/catalog fields with empty TMDB values. */
export function mergeModalMovie<
  T extends {
    title?: string;
    overview?: string;
    release_date?: string;
    poster_path?: string | null;
    backdrop_path?: string | null;
    vote_average?: number;
    genres?: { id: number; name: string }[];
    credits?: unknown;
    videos?: unknown;
    imdb_genres?: string[];
    omdb?: { genre?: string | null };
    tagline?: string;
  },
>(
  prev: T | null,
  incoming: T,
  seed: CatalogDetailsSeed | null | undefined,
  fallback?: CatalogSeedFallback | null
): T {
  return preserveSeedBackdrop(
    {
      ...(prev ?? {}),
      ...incoming,
      title: incoming.title || prev?.title || seed?.title || "",
      overview: pickOverview(incoming.overview, prev?.overview, seed, fallback),
      release_date: pickReleaseDate(
        incoming.release_date,
        prev?.release_date,
        seed,
        fallback
      ),
      poster_path:
        incoming.poster_path || prev?.poster_path || seed?.posterPath || null,
      vote_average:
        incoming.vote_average || prev?.vote_average || seed?.voteAverage || 0,
      genres: incoming.genres?.length ? incoming.genres : (prev?.genres ?? []),
      credits: incoming.credits ?? prev?.credits,
      videos: incoming.videos ?? prev?.videos,
      imdb_genres: incoming.imdb_genres?.length
        ? incoming.imdb_genres
        : prev?.imdb_genres,
      omdb: incoming.omdb ?? prev?.omdb,
      tagline: incoming.tagline?.trim() ? incoming.tagline : (prev?.tagline ?? ""),
    },
    seed
  );
}

export function mergeModalShow<
  T extends {
    name?: string;
    overview?: string;
    first_air_date?: string;
    poster_path?: string | null;
    backdrop_path?: string | null;
    vote_average?: number;
    genres?: { id: number; name: string }[];
    aggregate_credits?: unknown;
    videos?: unknown;
    imdb_genres?: string[];
    omdb?: { genre?: string | null };
    tagline?: string | null;
  },
>(
  prev: T | null,
  incoming: T,
  seed: CatalogDetailsSeed | null | undefined,
  fallback?: CatalogSeedFallback | null
): T {
  const fallbackAsMovie = fallback
    ? {
        overview: fallback.overview,
        release_date: fallback.release_date,
      }
    : null;

  return preserveSeedBackdrop(
    {
      ...(prev ?? {}),
      ...incoming,
      name: incoming.name || prev?.name || seed?.title || "",
      overview: pickOverview(incoming.overview, prev?.overview, seed, fallbackAsMovie),
      first_air_date: pickReleaseDate(
        incoming.first_air_date,
        prev?.first_air_date,
        seed,
        fallbackAsMovie
      ),
      poster_path:
        incoming.poster_path || prev?.poster_path || seed?.posterPath || null,
      vote_average:
        incoming.vote_average || prev?.vote_average || seed?.voteAverage || 0,
      genres: incoming.genres?.length ? incoming.genres : (prev?.genres ?? []),
      aggregate_credits: incoming.aggregate_credits ?? prev?.aggregate_credits,
      videos: incoming.videos ?? prev?.videos,
      imdb_genres: incoming.imdb_genres?.length
        ? incoming.imdb_genres
        : prev?.imdb_genres,
      omdb: incoming.omdb ?? prev?.omdb,
      tagline: incoming.tagline?.trim() ? incoming.tagline : (prev?.tagline ?? null),
    },
    seed
  );
}
