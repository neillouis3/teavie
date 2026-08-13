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

/** Minimum IMDb vote count (from OMDb) for top-rated browse inclusion. */
export const CATALOG_TOP_RATED_MIN_IMDB_VOTES = 2500;

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

/** Parse OMDb/TMDB vote counts (handles `"218,530"` strings from legacy docs). */
export function parseCatalogVoteCount(raw) {
  if (typeof raw === "number" && Number.isFinite(raw) && raw > 0) return raw;
  if (typeof raw === "string") {
    const n = Number(raw.replace(/,/g, "").trim());
    if (Number.isFinite(n) && n > 0) return n;
  }
  return 0;
}

/**
 * IMDb vote count from OMDb enrichment, else TMDB vote_count.
 * @param {Record<string, unknown>} doc
 */
export function catalogAudienceVoteCount(doc) {
  const omdb = doc.omdb;
  if (omdb && typeof omdb === "object") {
    const imdbVotes = parseCatalogVoteCount(
      /** @type {Record<string, unknown>} */ (omdb).imdbVotes
    );
    if (imdbVotes > 0) return imdbVotes;
  }
  return parseCatalogVoteCount(doc.vote_count);
}

/** Row has OMDb IMDb rating (vote_average was sourced from imdbRating on enrich). */
export function hasOmdbImdbRating(doc) {
  if (!doc || typeof doc !== "object") return false;
  const omdb = /** @type {Record<string, unknown>} */ (doc).omdb;
  if (!omdb || typeof omdb !== "object") return false;
  return (
    parseCatalogVoteCount(
      /** @type {Record<string, unknown>} */ (omdb).imdbVotes
    ) >= CATALOG_IMDB_RATING_MIN_VOTES
  );
}

/** @param {unknown} doc */
function catalogOmdbRecord(doc) {
  if (!doc || typeof doc !== "object") return null;
  const omdb = /** @type {Record<string, unknown>} */ (doc).omdb;
  return omdb && typeof omdb === "object" ? omdb : null;
}

/**
 * TMDB score + audience from a catalog doc.
 * Skips root `vote_average` when it was overwritten by OMDb (matches `omdb.imdbRating`).
 * @param {unknown} doc
 */
export function catalogTmdbVoteFromDoc(doc) {
  if (!doc || typeof doc !== "object") return { vote: null, count: 0 };
  const d = /** @type {Record<string, unknown>} */ (doc);
  const tmdb =
    d.tmdb && typeof d.tmdb === "object"
      ? /** @type {Record<string, unknown>} */ (d.tmdb)
      : null;

  const subVote = normalizedCatalogVoteAverage(tmdb?.vote_average);
  const subCount = parseCatalogVoteCount(tmdb?.vote_count);
  if (subVote) {
    return {
      vote: subVote,
      count: subCount,
      explicit: true,
    };
  }

  const omdbRating = normalizedCatalogVoteAverage(catalogOmdbRecord(d)?.imdbRating);
  const storedVote = normalizedCatalogVoteAverage(d.vote_average);
  const storedCount = parseCatalogVoteCount(d.vote_count);

  if (storedVote && !(omdbRating != null && storedVote === omdbRating)) {
    return {
      vote: storedVote,
      count: storedCount,
      explicit: false,
    };
  }

  return { vote: null, count: 0, explicit: false };
}

/** IMDb score + audience from OMDb enrichment. @param {unknown} doc */
export function catalogImdbVoteFromDoc(doc) {
  if (!doc || typeof doc !== "object") return { vote: null, count: 0 };
  const omdb = catalogOmdbRecord(doc);
  if (!omdb) return { vote: null, count: 0 };
  const vote = normalizedCatalogVoteAverage(omdb.imdbRating);
  const count = parseCatalogVoteCount(omdb.imdbVotes);
  return {
    vote,
    count,
  };
}

/**
 * Single 0–10 display score for cards, browse, and modals.
 * Movies/TV: prefer IMDb/OMDb when credible, else TMDB with enough voters, else best available.
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

  const tmdb = catalogTmdbVoteFromDoc(d);
  const imdb = catalogImdbVoteFromDoc(d);

  if (imdb.vote && imdb.count >= CATALOG_IMDB_RATING_MIN_VOTES) return imdb.vote;
  if (tmdb.explicit && tmdb.vote) return tmdb.vote;
  if (tmdb.vote && tmdb.count >= CATALOG_POPULAR_MIN_VOTE_COUNT) return tmdb.vote;
  return tmdb.vote ?? imdb.vote ?? null;
}

/** Build display vote from partial catalog / TMDB modal fields. @param {unknown} parts */
export function resolveCatalogDisplayVote(parts) {
  return catalogDisplayVoteAverage(parts);
}

/** Minimum OMDb imdbVotes before IMDb is used for display / sort. */
export const CATALOG_IMDB_RATING_MIN_VOTES = 50;

function mongoConvertDouble(input) {
  return { $convert: { input, to: "double", onError: 0, onNull: 0 } };
}

/** Mongo: TMDB vote_count (subdoc first; skip OMDb-overwritten root counts). */
export function mongoTmdbVoteCountExpr() {
  const subCount = mongoConvertDouble("$tmdb.vote_count");
  const rootCount = mongoConvertDouble("$vote_count");
  const rootVote = mongoConvertDouble("$vote_average");
  const imdbVote = mongoConvertDouble("$omdb.imdbRating");
  return {
    $cond: {
      if: { $gt: [subCount, 0] },
      then: subCount,
      else: {
        $cond: {
          if: {
            $and: [
              { $gt: [rootCount, 0] },
              { $ne: [rootVote, imdbVote] },
            ],
          },
          then: rootCount,
          else: 0,
        },
      },
    },
  };
}

/** Mongo: IMDb vote count from OMDb enrichment. */
export function mongoImdbVoteCountExpr() {
  return mongoConvertDouble("$omdb.imdbVotes");
}

/** Mongo: TMDB vote_average (subdoc first; skip OMDb-overwritten root score). */
export function mongoTmdbVoteAverageExpr() {
  const subVote = mongoConvertDouble("$tmdb.vote_average");
  const rootVote = mongoConvertDouble("$vote_average");
  const imdbVote = mongoConvertDouble("$omdb.imdbRating");
  return {
    $cond: {
      if: { $gt: [subVote, 0] },
      then: subVote,
      else: {
        $cond: {
          if: {
            $and: [{ $gt: [rootVote, 0] }, { $ne: [rootVote, imdbVote] }],
          },
          then: rootVote,
          else: 0,
        },
      },
    },
  };
}

/** Mongo: prefer OMDb IMDb rating when enough voters; else TMDB vote_average. */
export function mongoPreferImdbVoteExpr() {
  const imdbVotes = mongoImdbVoteCountExpr();
  const imdbRating = mongoConvertDouble("$omdb.imdbRating");
  const tmdbVote = mongoTmdbVoteAverageExpr();
  return {
    $cond: {
      if: { $gte: [imdbVotes, CATALOG_IMDB_RATING_MIN_VOTES] },
      then: imdbRating,
      else: tmdbVote,
    },
  };
}

/** Mongo: IMDb vote count when present, else TMDB vote_count. */
export function mongoPreferAudienceVoteCountExpr() {
  const imdbVotes = {
    $convert: {
      input: "$omdb.imdbVotes",
      to: "double",
      onError: 0,
      onNull: 0,
    },
  };
  const tmdbCount = {
    $convert: {
      input: "$vote_count",
      to: "double",
      onError: 0,
      onNull: 0,
    },
  };
  return {
    $cond: {
      if: { $gt: [imdbVotes, 0] },
      then: imdbVotes,
      else: tmdbCount,
    },
  };
}

/**
 * Mongo display vote — mirrors {@link catalogDisplayVoteAverage}.
 * @param {{ anime?: boolean }} [opts] Pass `anime: true` when every row is anime.
 */
export function mongoCatalogDisplayVoteExpr(opts = {}) {
  const tmdbVote = mongoTmdbVoteAverageExpr();
  const tmdbCount = mongoTmdbVoteCountExpr();
  const imdbVote = mongoConvertDouble("$omdb.imdbRating");
  const imdbCount = mongoImdbVoteCountExpr();
  const anilistVote = {
    $cond: {
      if: { $gt: [{ $ifNull: ["$anilist.averageScore", 0] }, 0] },
      then: { $divide: ["$anilist.averageScore", 10] },
      else: 0,
    },
  };
  const animeVote = {
    $max: [{ $max: [imdbVote, tmdbVote] }, anilistVote],
  };
  const movieTvVote = {
    $cond: {
      if: {
        $and: [
          { $gte: [imdbCount, CATALOG_IMDB_RATING_MIN_VOTES] },
          { $gt: [imdbVote, 0] },
        ],
      },
      then: imdbVote,
      else: {
        $cond: {
          if: { $gt: [mongoConvertDouble("$tmdb.vote_average"), 0] },
          then: mongoConvertDouble("$tmdb.vote_average"),
          else: {
            $cond: {
              if: {
                $and: [
                  { $gte: [tmdbCount, CATALOG_POPULAR_MIN_VOTE_COUNT] },
                  { $gt: [tmdbVote, 0] },
                ],
              },
              then: tmdbVote,
              else: { $max: [tmdbVote, imdbVote] },
            },
          },
        },
      },
    },
  };

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
      else: movieTvVote,
    },
  };
}

/**
 * Score for top-rated browse/rails inclusion — strict vote gates, decoupled from card display.
 * Returns 0 when the row lacks a credible audience (excluded from top-rated lists).
 * @param {{ anime?: boolean }} [opts]
 */
export function mongoTopRatedVoteExpr(opts = {}) {
  if (opts.anime === true) {
    return mongoCatalogDisplayVoteExpr({ anime: true });
  }

  const imdbVotes = mongoImdbVoteCountExpr();
  const imdbRating = mongoConvertDouble("$omdb.imdbRating");
  const tmdbVote = mongoTmdbVoteAverageExpr();
  const tmdbCount = mongoTmdbVoteCountExpr();
  const isKdrama = {
    $or: [
      { $eq: ["$is_kdrama", true] },
      { $in: ["kdrama", { $ifNull: ["$catalog_categories", []] }] },
    ],
  };

  return {
    $cond: {
      if: { $gte: [imdbVotes, CATALOG_TOP_RATED_MIN_IMDB_VOTES] },
      then: imdbRating,
      else: {
        $cond: {
          if: { $gte: [tmdbCount, CATALOG_TOP_RATED_MIN_TMDB_VOTE_COUNT] },
          then: tmdbVote,
          else: {
            $cond: {
              if: {
                $and: [
                  isKdrama,
                  { $gte: [tmdbCount, CATALOG_TOP_RATED_MIN_VOTE_COUNT] },
                ],
              },
              then: tmdbVote,
              else: 0,
            },
          },
        },
      },
    },
  };
}

/**
 * Top-rated sort key — score weighted by log10(votes) so widely-rated titles outrank niche 10s.
 * @param {object} voteExpr Mongo expression from {@link mongoTopRatedVoteExpr}.
 */
export function mongoTopRatedSortExpr(voteExpr) {
  const weight = mongoPreferAudienceVoteCountExpr();
  return {
    $multiply: [voteExpr, { $log10: { $add: [weight, 10] } }],
  };
}

/**
 * `$match` for top-rated browse/rails — uses {@link mongoTopRatedVoteExpr}, not card display scores.
 * @param {{ anime?: boolean; minVoteAverage?: number }} [opts]
 */
export function mongoTopRatedQualityMatch(opts = {}) {
  const minVoteAverage =
    opts.minVoteAverage ?? CATALOG_TOP_RATED_MIN_VOTE_AVERAGE;

  return { _topRatedVote: { $gte: minVoteAverage } };
}

/** Mongo expression for tie-breaking top-rated sorts (IMDb votes preferred). */
export function mongoCatalogAudienceVoteCountExpr() {
  return mongoPreferAudienceVoteCountExpr();
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
