/**
 * Shared helpers for /api/movies and /api/tv catalog filters.
 */

import { BLOCKED_MOVIE_PRODUCTION_COMPANIES } from "./tmdbMovieContentPolicy.js";
import {
  imdbGenreLabelFromBrowseParam,
  imdbGenreMatchConditions,
} from "./imdbGenres.js";

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
 * K-Drama browse: Korean TV (non-anime), tagged or inferred from origin + language.
 * @returns {Record<string, unknown>}
 */
export function catalogKdramaClause() {
  return {
    $or: [
      { catalog_categories: "kdrama" },
      { is_kdrama: true },
      {
        $and: [
          { type: "tv" },
          catalogNotAnimeCatalogIdMongoExpr(),
          {
            $or: [
              { origin_country: "KR" },
              { "omdb.country": { $regex: "Korea", $options: "i" } },
            ],
          },
          {
            $or: [
              { original_language: "ko" },
              { "omdb.language": { $regex: "Korean", $options: "i" } },
            ],
          },
        ],
      },
    ],
  };
}

/**
 * @param {string | null | undefined} slug IMDb genre slug (e.g. `drama`, `romance`)
 * @returns {Record<string, unknown> | null}
 */
export function catalogImdbGenreMatchClause(slug) {
  const label = imdbGenreLabelFromBrowseParam(slug);
  if (!label) return null;
  return imdbGenreMatchConditions(label);
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

  /** @type {Record<string, unknown>[]} */
  const extra = [];

  const genre = searchParams.get("genre")?.trim();
  if (genre) {
    const imdbClause = catalogImdbGenreMatchClause(genre);
    if (imdbClause) extra.push(imdbClause);
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
    extra.unshift(filter, catalogMoviePolicyClause());
    return extra.length > 2 ? { $and: extra } : { $and: [filter, catalogMoviePolicyClause()] };
  }

  if (extra.length > 0) {
    return { $and: [filter, ...extra] };
  }

  return filter;
}

/**
 * K-Drama browse filters (IMDb genre slugs + year + title search).
 * @param {URLSearchParams} searchParams
 */
export function buildKdramaCatalogFilter(searchParams) {
  /** @type {Record<string, unknown>[]} */
  const clauses = [catalogKdramaClause()];

  const genre = searchParams.get("genre")?.trim();
  if (genre) {
    const imdbClause = catalogImdbGenreMatchClause(genre);
    if (imdbClause) clauses.push(imdbClause);
  }

  const yearMin = searchParams.get("year_min")?.trim();
  const yearMax = searchParams.get("year_max")?.trim();
  const yMinOk = yearMin && /^\d{4}$/.test(yearMin);
  const yMaxOk = yearMax && /^\d{4}$/.test(yearMax);
  if (yMinOk || yMaxOk) {
    /** @type {Record<string, unknown>} */
    const dateRange = {};
    if (yMinOk) dateRange.$gte = `${yearMin}-01-01`;
    if (yMaxOk) dateRange.$lte = `${yearMax}-12-31`;
    clauses.push({ first_air_date: dateRange });
  }

  const q = searchParams.get("q")?.trim();
  if (q && q.length > 0) {
    const safe = escapeRegex(q);
    clauses.push({
      $or: [
        { title: { $regex: safe, $options: "i" } },
        { name: { $regex: safe, $options: "i" } },
      ],
    });
  }

  return { $and: clauses };
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
