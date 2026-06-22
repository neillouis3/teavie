/**
 * Shared helpers for /api/movies and /api/tv catalog filters.
 */

import { BLOCKED_MOVIE_PRODUCTION_COMPANIES } from "./tmdbMovieContentPolicy.js";

/** UTC calendar day YYYY-MM-DD for catalog filters. */
export function catalogTodayIsoUtc() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Require a TMDB-style date on `dateField` that is on or before `todayIso`.
 * @param {string} dateField
 * @param {string} todayIso YYYY-MM-DD
 */
export function releasedCatalogClause(dateField, todayIso) {
  return {
    $and: [
      { [dateField]: { $type: "string" } },
      { [dateField]: { $regex: /^\d{4}-\d{2}-\d{2}/ } },
      { [dateField]: { $lte: todayIso } },
    ],
  };
}

/**
 * Anime rows: hide when `first_air_date` is a future YYYY-MM-DD; keep rows with missing/empty date.
 * @param {string} todayIso
 */
export function releasedAnimeFirstAirClause(todayIso) {
  return {
    $or: [
      {
        $and: [
          { first_air_date: { $type: "string" } },
          { first_air_date: { $regex: /^\d{4}-\d{2}-\d{2}/ } },
          { first_air_date: { $lte: todayIso } },
        ],
      },
      { first_air_date: { $exists: false } },
      { first_air_date: null },
      { first_air_date: "" },
    ],
  };
}

export function escapeRegex(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Exclude TMDB-flagged adult / pornographic movies from catalog queries. */
export function catalogMovieHideAdultClause() {
  return { $nor: [{ adult: true }] };
}

/** Exclude movies from blocked production companies (see tmdbMovieContentPolicy). */
export function catalogMovieHideBlockedStudiosClause() {
  if (BLOCKED_MOVIE_PRODUCTION_COMPANIES.length === 0) return {};
  return {
    $nor: BLOCKED_MOVIE_PRODUCTION_COMPANIES.map((name) => ({
      production_companies: {
        $elemMatch: {
          name: { $regex: `^${escapeRegex(name)}$`, $options: "i" },
        },
      },
    })),
  };
}

/** Adult + blocked-studio exclusions for movie catalog queries. */
export function catalogMoviePolicyClause() {
  return {
    $and: [
      catalogMovieHideAdultClause(),
      catalogMovieHideBlockedStudiosClause(),
    ],
  };
}

/**
 * Title/name match for anime catalog rows: primary fields + `title_aliases` + nested AniList titles/synonyms.
 * @param {string} safe - output of `escapeRegex(q)`
 * @returns {Record<string, unknown>[]} conditions for use inside `$or`
 */
export function animeTitleSearchConditions(safe) {
  return [
    { title: { $regex: safe, $options: "i" } },
    { name: { $regex: safe, $options: "i" } },
    { title_aliases: { $regex: safe, $options: "i" } },
    { "anilist.title.romaji": { $regex: safe, $options: "i" } },
    { "anilist.title.english": { $regex: safe, $options: "i" } },
    { "anilist.title.native": { $regex: safe, $options: "i" } },
    { "anilist.synonyms": { $regex: safe, $options: "i" } },
  ];
}

/**
 * Anime browse/search only includes rows from the anime import (`anime_{id}`).
 * @returns {Record<string, unknown>} use inside `$and` for `find` / `$match`.
 */
export function catalogAnimeIdMongoExpr() {
  return {
    $expr: {
      $regexMatch: {
        input: { $toString: "$id" },
        regex: "^anime_",
      },
    },
  };
}

/** Catalog TV rows that are not imported `anime_{malId}` ids. */
export function catalogNotAnimeCatalogIdMongoExpr() {
  return {
    $expr: {
      $not: {
        $regexMatch: {
          input: { $toString: "$id" },
          regex: "^anime_",
        },
      },
    },
  };
}

/**
 * All TV browse: canonical catalog anime (`anime_*`) plus non-anime TV.
 * Excludes legacy duplicate anime rows (TMDB JP, etc.) that are not `anime_*`.
 */
export function catalogTvBrowseAudienceClause() {
  return {
    $or: [
      catalogAnimeIdMongoExpr(),
      { $nor: [{ is_anime: true }, { tags: "anime" }] },
    ],
  };
}

/**
 * All Shows browse: non-anime TV only. Anime lives on the dedicated anime page
 * (`/api/anime`), so exclude canonical `anime_*` rows plus anything flagged
 * `is_anime` / tagged `"anime"`.
 */
export function catalogTvBrowseNonAnimeClause() {
  return {
    $and: [
      catalogNotAnimeCatalogIdMongoExpr(),
      { $nor: [{ is_anime: true }, { tags: "anime" }] },
    ],
  };
}

/**
 * Released rule for combined TV + catalog anime: anime uses lenient first-air
 * (same as /api/anime); everything else uses strict TMDB-style date.
 * @param {string} dateField
 * @param {string} todayIso
 */
export function catalogTvBrowseReleasedClause(dateField, todayIso) {
  return {
    $or: [
      {
        $and: [
          catalogAnimeIdMongoExpr(),
          releasedAnimeFirstAirClause(todayIso),
        ],
      },
      {
        $and: [
          catalogNotAnimeCatalogIdMongoExpr(),
          releasedCatalogClause(dateField, todayIso),
        ],
      },
    ],
  };
}

/**
 * TMDB TV genre id filter that also matches catalog anime rows:
 * `genre_ids` on anime are MAL ids, so we match Jikan `genres.name` / AniList `genres`.
 * @param {number} tmdbGenreId
 */
export function catalogTmdbTvGenreMatchClause(tmdbGenreId) {
  /** @type {Record<number, string | null>} null = no extra anime branch */
  const animeRegexByTmdb = {
    10759: "^(Action|Adventure)$",
    16: "__ALL_ANIME__",
    35: "^(Comedy|Parody)$",
    80: "^Crime$",
    99: "^Documentary$",
    18: "^Drama$",
    10751: "^Family$",
    10762: "^(Kids|Children)$",
    9648: "^(Mystery|Suspense)$",
    10763: null,
    10764: "^Reality$",
    10765: "^(Science Fiction|Sci-Fi|Fantasy|Supernatural)$",
    10766: "^Soap$",
    10767: "^Talk$",
    10768: "^(War|Military)$",
    37: "^Western$",
  };
  const token = animeRegexByTmdb[tmdbGenreId];
  // Non-anime TV docs store genres as objects in `genres` ({ id, name }); legacy /
  // movie-style rows use the numeric `genre_ids` array. Match either.
  const parts = [
    { genre_ids: tmdbGenreId },
    { genres: { $elemMatch: { id: tmdbGenreId } } },
  ];

  if (token === "__ALL_ANIME__") {
    parts.push(catalogAnimeIdMongoExpr());
    return { $or: parts };
  }
  if (typeof token === "string" && token.length > 0) {
    const rx = new RegExp(token, "i");
    parts.push({
      $and: [
        catalogAnimeIdMongoExpr(),
        {
          $or: [
            { genres: { $elemMatch: { name: rx } } },
            { "anilist.genres": rx },
          ],
        },
      ],
    });
  }
  return parts.length === 1 ? parts[0] : { $or: parts };
}

/**
 * @param {URLSearchParams} searchParams
 * @param {{ type: "movie" | "tv"; dateField: string; animeMultilingualTitleSearch?: boolean }} opts
 */
export function buildCatalogFilter(
  searchParams,
  { type, dateField, animeMultilingualTitleSearch = false }
) {
  /** @type {Record<string, unknown>} */
  const filter = { type };

  const genre = searchParams.get("genre")?.trim();
  if (genre && /^\d+$/.test(genre)) {
    filter.genre_ids = parseInt(genre, 10);
  }

  const yearMin = searchParams.get("year_min")?.trim();
  const yearMax = searchParams.get("year_max")?.trim();
  const yMinOk = yearMin && /^\d{4}$/.test(yearMin);
  const yMaxOk = yearMax && /^\d{4}$/.test(yearMax);
  if (yMinOk || yMaxOk) {
    filter[dateField] = {};
    if (yMinOk) filter[dateField].$gte = `${yearMin}-01-01`;
    if (yMaxOk) filter[dateField].$lte = `${yearMax}-12-31`;
  }

  const q = searchParams.get("q")?.trim();
  if (q && q.length > 0) {
    const safe = escapeRegex(q);
    filter.$or = animeMultilingualTitleSearch
      ? animeTitleSearchConditions(safe)
      : [
          { title: { $regex: safe, $options: "i" } },
          { name: { $regex: safe, $options: "i" } },
        ];
  }

  if (type === "movie") {
    return { $and: [filter, catalogMoviePolicyClause()] };
  }

  return filter;
}

/**
 * @param {string} sortBy
 * @param {{ titleAsc: Record<string, number>; titleDesc: Record<string, number>; dateDesc: Record<string, number>; dateAsc: Record<string, number> }} fields
 */
export function catalogSort(sortBy, fields) {
  switch (sortBy) {
    case "release_year_asc":
      return fields.dateAsc;
    case "release_year":
      return fields.dateDesc;
    case "popularity":
      // TMDB: higher popularity = more popular. Anime uses aggregation + catalogPopularityScore.
      return { popularity: -1, _id: -1 };
    case "title_desc":
      return fields.titleDesc;
    case "runtime_desc":
      return { runtimeSeconds: -1, _id: -1 };
    case "runtime_asc":
      return { runtimeSeconds: 1, _id: -1 };
    case "title":
    default:
      return fields.titleAsc;
  }
}
