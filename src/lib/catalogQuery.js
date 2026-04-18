/**
 * Shared helpers for /api/movies and /api/tv catalog filters.
 */

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

/**
 * @param {URLSearchParams} searchParams
 * @param {{ type: "movie" | "tv"; dateField: string }} opts
 */
export function buildCatalogFilter(searchParams, { type, dateField }) {
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
    filter.$or = [
      { title: { $regex: safe, $options: "i" } },
      { name: { $regex: safe, $options: "i" } },
    ];
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
