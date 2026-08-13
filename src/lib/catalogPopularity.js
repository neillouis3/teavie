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
 * Single 0–10 display score for catalog cards/API: prefer TMDB/Jikan `vote_average`,
 * else AniList `averageScore` (0–100) scaled to 0–10 for `anime_*` rows.
 * @param {unknown} doc
 */
export function catalogDisplayVoteAverage(doc) {
  if (!doc || typeof doc !== "object") return null;
  const d = /** @type {Record<string, unknown>} */ (doc);
  const id = String(d.id ?? "");
  const anilist = d.anilist;
  const aniAvg =
    anilist && typeof anilist === "object"
      ? Number(/** @type {Record<string, unknown>} */ (anilist).averageScore)
      : NaN;

  if (id.startsWith("anime_") && Number.isFinite(aniAvg) && aniAvg > 0) {
    return quantizeVoteAverage(aniAvg / 10);
  }

  return normalizedCatalogVoteAverage(d.vote_average);
}

/**
 * Mongo sort/display key for catalog vote (0–10), aligned with {@link catalogDisplayVoteAverage}.
 * @param {{ anime?: boolean }} [opts] Pass `anime: true` when every row is anime.
 */
export function mongoCatalogDisplayVoteExpr(opts = {}) {
  const tmdbVote = {
    $convert: { input: "$vote_average", to: "double", onError: 0, onNull: 0 },
  };
  const anilistVote = {
    $cond: {
      if: { $gt: [{ $ifNull: ["$anilist.averageScore", 0] }, 0] },
      then: { $divide: ["$anilist.averageScore", 10] },
      else: 0,
    },
  };
  const animeVote = { $max: [tmdbVote, anilistVote] };

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
      else: tmdbVote,
    },
  };
}

/**
 * `$match` clause excluding noisy TMDB 10.0 rows for top-rated browse.
 * @param {{ anime?: boolean; minVoteAverage?: number; minVoteCount?: number }} [opts]
 */
export function mongoTopRatedQualityMatch(opts = {}) {
  const minVoteAverage =
    opts.minVoteAverage ?? CATALOG_TOP_RATED_MIN_VOTE_AVERAGE;
  const match = {
    _catalogVote: { $gte: minVoteAverage },
  };
  if (opts.anime !== true) {
    match.vote_count = {
      $gte: opts.minVoteCount ?? CATALOG_TOP_RATED_MIN_VOTE_COUNT,
    };
  }
  return match;
}

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
        $cond: {
          if: {
            $in: [{ $type: "$popularity" }, ["double", "decimal", "int", "long"]],
          },
          then: { $ifNull: ["$popularity", 0] },
          else: 0,
        },
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
