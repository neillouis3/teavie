/**
 * Single catalog convention: higher score = more popular (TMDB-style).
 *
 * - TV / movies: TMDB `popularity` (float, higher is better).
 * - Anime: prefer AniList `anilist.popularity` when set; else Jikan/MAL
 *   `popularity` is a rank (lower is better) — map with `MAL_RANK_INVERT_CEILING - rank`
 *   for positive integers below 1e6; larger ints or floats pass through.
 */

export const MAL_RANK_INVERT_CEILING = 10_000_000;

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
  const anilist = d.anilist;
  const ani =
    anilist && typeof anilist === "object"
      ? Number(/** @type {Record<string, unknown>} */ (anilist).popularity)
      : NaN;
  if (Number.isFinite(ani) && ani > 0) return ani;

  const p = Number(d.popularity);
  if (!Number.isFinite(p) || p <= 0) return 0;

  if (!Number.isInteger(p)) return p;

  if (p >= 1_000_000) return p;

  return Math.max(0, MAL_RANK_INVERT_CEILING - p);
}

/**
 * Mongo `$addFields` / `$sort` expression (anime-only collections / filters).
 * Mirrors {@link catalogPopularityScore} for documents where `is_anime` / `tags` / `id` imply anime.
 */
export function mongoAnimeCatalogPopularityExpr() {
  const C = MAL_RANK_INVERT_CEILING;
  return {
    $switch: {
      branches: [
        {
          case: { $gt: [{ $ifNull: ["$anilist.popularity", 0] }, 0] },
          then: "$anilist.popularity",
        },
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
