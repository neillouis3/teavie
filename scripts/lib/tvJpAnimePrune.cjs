/**
 * TV catalog cleanup: remove legacy TMDB-shaped JP animation that is not from
 * `import-anime-to-tv.js` (Jikan + MAL id). Canonical imports carry
 * `source: "jikan"`, `mal_id`, and `id: anime_{malId}`.
 *
 * Prune when: not `anime_*`, not Jikan import, and either JP+animation, or
 * TMDB numeric id + Japanese origin + anime-like / missing genre arrays (bad sync).
 */

const TMDB_ANIMATION_GENRE_ID = 16;

/** Canonical anime rows from the anime pipeline use string ids like `anime_63816`. */
function isCatalogAnimeId(doc) {
  return String(doc.id ?? "").startsWith("anime_");
}

/** TMDB TV rows in Mongo use numeric ids (or string digits only), not `anime_*`. */
function isTmdbNumericTvId(doc) {
  const id = doc.id;
  if (typeof id === "number" && Number.isFinite(id) && id > 0) return true;
  if (typeof id === "string" && /^[1-9]\d*$/.test(id.trim())) return true;
  return false;
}

/** Row produced by scripts/import-anime-to-tv.js (mapAnimeToTvDoc). */
function isJikanAnimeImport(doc) {
  if (doc.source !== "jikan") return false;
  const mal = doc.mal_id;
  if (typeof mal === "number" && Number.isFinite(mal) && mal > 0) return true;
  if (typeof mal === "string" && /^[1-9]\d*$/.test(String(mal).trim())) return true;
  return false;
}

function hasAnilistProvenance(doc) {
  const a = doc.anilist_id;
  if (typeof a === "number" && a > 0) return true;
  if (typeof a === "string" && /^[1-9]\d*$/.test(String(a).trim())) return true;

  const ext = doc.external_ids;
  if (ext && typeof ext === "object") {
    const e = ext.anilist_id;
    if (typeof e === "number" && e > 0) return true;
    if (typeof e === "string" && /^[1-9]\d*$/.test(e.trim())) return true;
  }
  return false;
}

function hasAnimeTag(doc) {
  const tags = doc.tags;
  if (!Array.isArray(tags)) return false;
  return tags.some((t) => String(t).toLowerCase() === "anime");
}

function isJapaneseOrigin(doc) {
  const oc = doc.origin_country;
  if (Array.isArray(oc) && oc.some((c) => String(c).toUpperCase() === "JP")) return true;
  if (doc.original_language === "ja") return true;
  return false;
}

/** TMDB animation genre only (does not use is_anime / tags). */
function hasAnimationGenreCore(doc) {
  const gids = doc.genre_ids;
  if (Array.isArray(gids) && gids.includes(TMDB_ANIMATION_GENRE_ID)) return true;

  const genres = doc.genres;
  if (
    Array.isArray(genres) &&
    genres.some(
      (g) =>
        g &&
        (g.id === TMDB_ANIMATION_GENRE_ID ||
          String(g.name || "").toLowerCase() === "animation")
    )
  ) {
    return true;
  }
  return false;
}

/**
 * Anime-like catalog row: explicit flag/tag, or JP (or ja audio) + animation genre.
 * Does not treat US cartoons as anime unless is_anime / anime tag is set.
 */
function isAnimeLike(doc) {
  if (doc.is_anime === true) return true;
  if (hasAnimeTag(doc)) return true;
  if (isJapaneseOrigin(doc) && hasAnimationGenreCore(doc)) return true;
  return false;
}

/** Legacy “anime” TV from TMDB JSON: Japan + animation genre, not the Jikan pipeline. */
function isOldCatalogJpAnimationTv(doc) {
  return isJapaneseOrigin(doc) && hasAnimationGenreCore(doc);
}

/**
 * TMDB sync sometimes drops genre arrays; JP/ja + both empty still matches many legacy anime rows (e.g. id 1429).
 * @see https://developer.themoviedb.org/reference/tv-series-details
 */
function isJapaneseOriginWithNoGenreData(doc) {
  if (!isJapaneseOrigin(doc)) return false;
  const gids = doc.genre_ids;
  const genres = doc.genres;
  const gidsEmpty = !Array.isArray(gids) || gids.length === 0;
  const genresEmpty = !Array.isArray(genres) || genres.length === 0;
  return gidsEmpty && genresEmpty;
}

/**
 * @param {Record<string, unknown>} doc - TV row or Mongo doc (must include type: "tv" when from DB)
 */
function shouldPruneTvAnimeWithoutAnilist(doc) {
  if (!doc || doc.type !== "tv") return false;
  if (isCatalogAnimeId(doc)) return false;
  if (isJikanAnimeImport(doc)) return false;

  if (isTmdbNumericTvId(doc)) {
    if (isOldCatalogJpAnimationTv(doc)) return true;
    if (isJapaneseOriginWithNoGenreData(doc)) return true;
    if (isJapaneseOrigin(doc) && isAnimeLike(doc)) return true;
    return false;
  }

  return isOldCatalogJpAnimationTv(doc);
}

/** @deprecated use shouldPruneTvAnimeWithoutAnilist */
const shouldPruneTvJpAnimeWithoutAnilist = shouldPruneTvAnimeWithoutAnilist;

module.exports = {
  TMDB_ANIMATION_GENRE_ID,
  isCatalogAnimeId,
  isTmdbNumericTvId,
  isJikanAnimeImport,
  isOldCatalogJpAnimationTv,
  isJapaneseOriginWithNoGenreData,
  hasAnilistProvenance,
  hasAnimeTag,
  isJapaneseOrigin,
  hasAnimationGenreCore,
  isAnimeLike,
  shouldPruneTvAnimeWithoutAnilist,
  shouldPruneTvJpAnimeWithoutAnilist,
};
