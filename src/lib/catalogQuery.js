/**
 * Shared helpers for /api/movies and /api/tv catalog filters.
 */

export function escapeRegex(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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
