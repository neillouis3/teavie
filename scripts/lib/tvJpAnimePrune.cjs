/**
 * TV catalog cleanup: Japanese animation that is not tied to AniList belongs in the
 * anime import pipeline, not the live-action TV catalog from TMDB JSON.
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

function isJapaneseOrigin(doc) {
  const oc = doc.origin_country;
  if (Array.isArray(oc) && oc.some((c) => String(c).toUpperCase() === "JP")) return true;
  if (doc.original_language === "ja") return true;
  return false;
}

function hasAnimationGenre(doc) {
  if (doc.is_anime === true) return true;
  const tags = doc.tags;
  if (Array.isArray(tags) && tags.some((t) => String(t).toLowerCase() === "anime")) return true;

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
 * @param {Record<string, unknown>} doc - TV row or Mongo doc (must include type: "tv" when from DB)
 */
function shouldPruneTvJpAnimeWithoutAnilist(doc) {
  if (!doc || doc.type !== "tv") return false;
  if (hasAnilistProvenance(doc)) return false;
  if (!isJapaneseOrigin(doc)) return false;
  if (!hasAnimationGenre(doc)) return false;
  return true;
}

module.exports = {
  TMDB_ANIMATION_GENRE_ID,
  hasAnilistProvenance,
  isJapaneseOrigin,
  hasAnimationGenre,
  shouldPruneTvJpAnimeWithoutAnilist,
};
