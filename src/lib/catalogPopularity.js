/**
 * Single catalog convention: higher score = more popular (TMDB-style).
 *
 * - TV / movies: TMDB `popularity` (float, higher is better).
 * - Anime: max of AniList `anilist.popularity` and inverted MAL rank from `popularity`
 *   (Jikan stores MAL rank as a positive integer — lower rank = more popular).
 */

export const MAL_RANK_INVERT_CEILING = 10_000_000;

/** Minimum TMDB-style vote_average (0–10) for popular browse rails. */
export const CATALOG_POPULAR_MIN_VOTE_AVERAGE = 6.5;

/** Ignore TMDB rows with very few votes (avoids noisy high scores). */
export const CATALOG_POPULAR_MIN_VOTE_COUNT = 50;

/** Minimum score for “top rated” browse / rails (0–10). */
export const CATALOG_TOP_RATED_MIN_VOTE_AVERAGE = 7;

/** Minimum TMDB vote_count for top-rated TV / movie browse (blocks lone 10.0 scores). */
export const CATALOG_TOP_RATED_MIN_VOTE_COUNT = 50;

/** TMDB vote_count before we show a rating on cards without IMDb/OMDb enrichment. */
export const CATALOG_DISPLAY_MIN_TMDB_VOTE_COUNT = 50;

/** Minimum IMDb vote count (from OMDb) for top-rated browse inclusion. */
export const CATALOG_TOP_RATED_MIN_IMDB_VOTES = 250;

/** TMDB vote_count fallback for top-rated when OMDb votes are missing. */
export const CATALOG_TOP_RATED_MIN_TMDB_VOTE_COUNT = 2000;

/**
 * @param {unknown} row TMDB list row or catalog item with vote_average / vote_count.
 * @param {{ minVoteAverage?: number; minVoteCount?: number }} [opts]
 */
export function passesPopularQualityGate(
  row,
  opts = {}
) {
  if (!row || typeof row !== "object") return false;
  const minVoteAverage = opts.minVoteAverage ?? CATALOG_POPULAR_MIN_VOTE_AVERAGE;
  const minVoteCount = opts.minVoteCount ?? CATALOG_POPULAR_MIN_VOTE_COUNT;
  const vote = Number(/** @type {Record<string, unknown>} */ (row).vote_average);
  const count = Number(/** @type {Record<string, unknown>} */ (row).vote_count ?? 0);
  if (!Number.isFinite(vote) || vote < minVoteAverage) return false;
  if (Number.isFinite(count) && count > 0 && count < minVoteCount) return false;
  return true;
}

/** @param {unknown} voteAverage */
export function meetsMinCatalogVoteAverage(
  voteAverage,
  min = CATALOG_POPULAR_MIN_VOTE_AVERAGE
) {
  const vote = Number(voteAverage);
  return Number.isFinite(vote) && vote >= min;
}

/** @param {unknown} popularity */
function malCatalogPopularityScore(popularity) {
  const p = Number(popularity);
  if (!Number.isFinite(p) || p <= 0) return 0;
  if (!Number.isInteger(p)) return p;
  if (p >= 1_000_000) return p;
  return Math.max(0, MAL_RANK_INVERT_CEILING - p);
}

/** Mongo expression mirroring {@link malCatalogPopularityScore}. */
function mongoMalCatalogPopularityScoreExpr() {
  const C = MAL_RANK_INVERT_CEILING;
  return {
    $switch: {
      branches: [
        {
          case: {
            $and: [
              { $in: [{ $type: "$popularity" }, ["double", "decimal"]] },
              { $gt: ["$popularity", 0] },
            ],
          },
          then: "$popularity",
        },
        {
          case: { $gte: ["$popularity", 1_000_000] },
          then: "$popularity",
        },
        {
          case: {
            $and: [
              { $gt: ["$popularity", 0] },
              { $lt: ["$popularity", 1_000_000] },
              { $in: [{ $type: "$popularity" }, ["int", "long"]] },
            ],
          },
          then: { $max: [0, { $subtract: [C, "$popularity"] }] },
        },
        {
          case: { $gt: ["$popularity", 0] },
          then: "$popularity",
        },
      ],
      default: 0,
    },
  };
}

/** @param {unknown} doc */
function isAnimeDoc(doc, opts = {}) {
  if (opts.anime === true) return true;
  if (!doc || typeof doc !== "object") return false;
  const d = /** @type {Record<string, unknown>} */ (doc);
  if (d.is_anime === true) return true;
  const tags = d.tags;
  if (Array.isArray(tags) && tags.includes("anime")) return true;
  const id = d.id;
  if (typeof id === "string" && id.startsWith("anime_")) return true;
  return false;
}

/**
 * @param {unknown} doc
 * @param {{ anime?: boolean }} [opts] Pass `anime: true` for /api/anime payloads (all rows are anime).
 */
export function catalogPopularityScore(doc, opts = {}) {
  if (!doc || typeof doc !== "object") return 0;

  if (!isAnimeDoc(doc, opts)) {
    const p = Number(/** @type {Record<string, unknown>} */ (doc).popularity);
    return Number.isFinite(p) ? p : 0;
  }

  const d = /** @type {Record<string, unknown>} */ (doc);
  const malScore = malCatalogPopularityScore(d.popularity);
  const anilist = d.anilist;
  const ani =
    anilist && typeof anilist === "object"
      ? Number(/** @type {Record<string, unknown>} */ (anilist).popularity)
      : NaN;
  const aniScore = Number.isFinite(ani) && ani > 0 ? ani : 0;
  return Math.max(malScore, aniScore);
}

/**
 * Round a 0–10 score to one decimal place.
 * @param {unknown} value
 */
export function quantizeVoteAverage(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 10) / 10;
}

/**
 * Normalize a stored vote to 0–10 (handles numeric strings and 0–100 mis-scales).
 * @param {unknown} raw
 */
export function normalizedCatalogVoteAverage(raw) {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return null;
  if (n > 10 && n <= 100) return quantizeVoteAverage(n / 10);
  if (n > 100) return null;
  return quantizeVoteAverage(n);
}

/**
 * IMDb vote count from OMDb enrichment, else TMDB vote_count.
 * @param {Record<string, unknown>} doc
 */
export function catalogAudienceVoteCount(doc) {
  const omdb = doc.omdb;
  if (omdb && typeof omdb === "object") {
    const imdbVotes = Number(
      /** @type {Record<string, unknown>} */ (omdb).imdbVotes
    );
    if (Number.isFinite(imdbVotes) && imdbVotes > 0) return imdbVotes;
  }
  const tmdb = Number(doc.vote_count);
  return Number.isFinite(tmdb) && tmdb > 0 ? tmdb : 0;
}

/** Row has OMDb IMDb rating (vote_average was sourced from imdbRating on enrich). */
export function hasOmdbImdbRating(doc) {
  if (!doc || typeof doc !== "object") return false;
  const omdb = /** @type {Record<string, unknown>} */ (doc).omdb;
  if (!omdb || typeof omdb !== "object") return false;
  const imdbVotes = Number(
    /** @type {Record<string, unknown>} */ (omdb).imdbVotes
  );
  return Number.isFinite(imdbVotes) && imdbVotes >= 50;
}

/**
 * Single 0–10 display score for catalog cards/API.
 * Movies/TV: prefer OMDb/IMDb-backed `vote_average`; else TMDB only with enough voters.
 * Anime: AniList averageScore, else TMDB/Jikan vote_average.
 * @param {unknown} doc
 */
export function catalogDisplayVoteAverage(doc) {
  if (!doc || typeof doc !== "object") return null;
  const d = /** @type {Record<string, unknown>} */ (doc);
  const id = String(d.id ?? "");
  const isAnime =
    id.startsWith("anime_") ||
    d.is_anime === true ||
    (Array.isArray(d.tags) && d.tags.includes("anime"));

  const anilist = d.anilist;
  const aniAvg =
    anilist && typeof anilist === "object"
      ? Number(/** @type {Record<string, unknown>} */ (anilist).averageScore)
      : NaN;

  if (isAnime) {
    if (Number.isFinite(aniAvg) && aniAvg > 0) {
      return quantizeVoteAverage(aniAvg / 10);
    }
    const malVote = normalizedCatalogVoteAverage(d.vote_average);
    if (malVote) return malVote;
    return null;
  }

  const vote = normalizedCatalogVoteAverage(d.vote_average);
  const omdb = d.omdb;
  const omdbRating =
    omdb && typeof omdb === "object"
      ? normalizedCatalogVoteAverage(
          /** @type {Record<string, unknown>} */ (omdb).imdbRating
        )
      : null;
  const displayVote = omdbRating ?? vote;
  if (!displayVote) return null;

  if (hasOmdbImdbRating(d)) return displayVote;

  const tmdbCount = Number(d.vote_count);
  if (Number.isFinite(tmdbCount) && tmdbCount >= CATALOG_DISPLAY_MIN_TMDB_VOTE_COUNT) {
    return displayVote;
  }

  const isKdrama =
    d.is_kdrama === true ||
    (Array.isArray(d.catalog_categories) && d.catalog_categories.includes("kdrama"));
  if (isKdrama && displayVote) {
    if (!Number.isFinite(tmdbCount) || tmdbCount <= 0) return displayVote;
    if (tmdbCount >= CATALOG_POPULAR_MIN_VOTE_COUNT) return displayVote;
  }

  return null;
}

/**
 * Mongo sort/display key for catalog vote (0–10), aligned with {@link catalogDisplayVoteAverage}.
 * @param {{ anime?: boolean }} [opts] Pass `anime: true` when every row is anime.
 */
export function mongoCatalogDisplayVoteExpr(opts = {}) {
  const tmdbVote = {
    $convert: { input: "$vote_average", to: "double", onError: 0, onNull: 0 },
  };
  const omdbImdbVote = {
    $convert: {
      input: "$omdb.imdbRating",
      to: "double",
      onError: 0,
      onNull: 0,
    },
  };
  const resolvedVote = { $max: [omdbImdbVote, tmdbVote] };
  const anilistVote = {
    $cond: {
      if: { $gt: [{ $ifNull: ["$anilist.averageScore", 0] }, 0] },
      then: { $divide: ["$anilist.averageScore", 10] },
      else: 0,
    },
  };
  const animeVote = { $max: [resolvedVote, anilistVote] };

  if (opts.anime === true) return animeVote;

  return {
    $cond: {
      if: {
        $regexMatch: {
          input: { $toString: "$id" },
          regex: "^anime_",
        },
      },
      then: animeVote,
      else: resolvedVote,
    },
  };
}

/**
 * `$match` clause for top-rated browse — requires a real audience, not TMDB noise.
 * @param {{ anime?: boolean; minVoteAverage?: number; minVoteCount?: number }} [opts]
 */
export function mongoTopRatedQualityMatch(opts = {}) {
  const minVoteAverage =
    opts.minVoteAverage ?? CATALOG_TOP_RATED_MIN_VOTE_AVERAGE;

  if (opts.anime === true) {
    return { _catalogVote: { $gte: minVoteAverage } };
  }

  const minImdbVotes = opts.minVoteCount ?? CATALOG_TOP_RATED_MIN_IMDB_VOTES;

  const isKdrama = {
    $or: [{ is_kdrama: true }, { catalog_categories: "kdrama" }],
  };

  return {
    $and: [
      { _catalogVote: { $gte: minVoteAverage } },
      {
        $or: [
          { "omdb.imdbVotes": { $gte: minImdbVotes } },
          {
            $and: [
              isKdrama,
              { vote_count: { $gte: CATALOG_TOP_RATED_MIN_VOTE_COUNT } },
            ],
          },
          { vote_count: { $gte: CATALOG_TOP_RATED_MIN_TMDB_VOTE_COUNT } },
        ],
      },
    ],
  };
}

/** Mongo expression for tie-breaking top-rated sorts (IMDb votes preferred). */
export function mongoCatalogAudienceVoteCountExpr() {
  return {
    $max: [
      {
        $convert: {
          input: "$omdb.imdbVotes",
          to: "double",
          onError: 0,
          onNull: 0,
        },
      },
      {
        $convert: {
          input: "$vote_count",
          to: "double",
          onError: 0,
          onNull: 0,
        },
      },
    ],
  };
}

/**
 * Browse "Popular" quality — real audience + minimum score (aligned with explore rails).
 * @param {{ anime?: boolean; minVoteAverage?: number; minVoteCount?: number }} [opts]
 */
export function mongoPopularBrowseQualityMatch(opts = {}) {
  const minVoteAverage =
    opts.minVoteAverage ?? CATALOG_POPULAR_MIN_VOTE_AVERAGE;
  const minVoteCount = opts.minVoteCount ?? CATALOG_POPULAR_MIN_VOTE_COUNT;

  if (opts.anime === true) {
    return { _catalogVote: { $gte: minVoteAverage } };
  }

  const isKdrama = {
    $or: [{ is_kdrama: true }, { catalog_categories: "kdrama" }],
  };

  return {
    $or: [
      {
        $and: [
          { _catalogVote: { $gte: minVoteAverage } },
          {
            $or: [
              { "omdb.imdbVotes": { $gte: minVoteCount } },
              { vote_count: { $gte: minVoteCount } },
            ],
          },
        ],
      },
      {
        $and: [
          isKdrama,
          { _catalogVote: { $gte: minVoteAverage } },
          { vote_count: { $gte: minVoteCount } },
        ],
      },
    ],
  };
}

/** Rows with at least one TMDB image path (excludes empty catalog placeholders). */
export const CATALOG_BROWSE_HAS_ART = {
  $or: [
    { poster_path: { $type: "string", $regex: /\S/ } },
    { backdrop_path: { $type: "string", $regex: /\S/ } },
  ],
};

/**
 * Mongo `$addFields` / `$sort` expression (anime-only collections / filters).
 * Mirrors {@link catalogPopularityScore} for documents where `is_anime` / `tags` / `id` imply anime.
 */
export function mongoAnimeCatalogPopularityExpr() {
  return {
    $max: [
      mongoMalCatalogPopularityScoreExpr(),
      { $ifNull: ["$anilist.popularity", 0] },
    ],
  };
}

/**
 * Mongo sort key for /api/tv when mixing TMDB TV and catalog `anime_*` rows.
 */
export function mongoMixedTvCatalogPopularityExpr() {
  return {
    $cond: {
      if: {
        $regexMatch: {
          input: { $toString: "$id" },
          regex: "^anime_",
        },
      },
      then: mongoAnimeCatalogPopularityExpr(),
      else: {
        $convert: { input: "$popularity", to: "double", onError: 0, onNull: 0 },
      },
    },
  };
}

/**
 * Popularity sort key for mixed `content` rows (movies + TV + anime_*), aligned with
 * {@link catalogPopularityScore} / {@link mongoMixedTvCatalogPopularityExpr}.
 */
export function mongoCatalogPopularitySortExpr() {
  return {
    $cond: {
      if: { $eq: ["$type", "movie"] },
      then: {
        $convert: { input: "$popularity", to: "double", onError: 0, onNull: 0 },
      },
      else: mongoMixedTvCatalogPopularityExpr(),
    },
  };
}
