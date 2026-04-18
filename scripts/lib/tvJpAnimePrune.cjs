/**
 * TV catalog cleanup: rows that are “anime” but not tied to AniList belong in the
 * anime import pipeline, not the general TV catalog from TMDB JSON.
 *
 * Prune when ALL of:
 * - type is tv
 * - no AniList id (top-level or external_ids)
 * - looks like anime: is_anime flag, "anime" tag, or Japanese origin + animation genre
 */

const TMDB_ANIMATION_GENRE_ID = 16;

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

/**
 * @param {Record<string, unknown>} doc - TV row or Mongo doc (must include type: "tv" when from DB)
 */
function shouldPruneTvAnimeWithoutAnilist(doc) {
  if (!doc || doc.type !== "tv") return false;
  if (hasAnilistProvenance(doc)) return false;
  if (!isAnimeLike(doc)) return false;
  return true;
}

/** @deprecated use shouldPruneTvAnimeWithoutAnilist */
const shouldPruneTvJpAnimeWithoutAnilist = shouldPruneTvAnimeWithoutAnilist;

module.exports = {
  TMDB_ANIMATION_GENRE_ID,
  hasAnilistProvenance,
  hasAnimeTag,
  isJapaneseOrigin,
  hasAnimationGenreCore,
  isAnimeLike,
  shouldPruneTvAnimeWithoutAnilist,
  shouldPruneTvJpAnimeWithoutAnilist,
};
