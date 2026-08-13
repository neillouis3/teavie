import { isBlockedAdultAnimeDoc } from "./animeContentPolicy.js";

/**
 * Detect legacy TMDB-shaped Japanese animation in the TV catalog (numeric TMDB ids).
 * Canonical anime uses `anime_{malId}` from the Jikan import pipeline.
 */

export const TMDB_ANIMATION_GENRE_ID = 16;

/** Canonical anime rows from the anime pipeline use string ids like `anime_63816`. */
export function isCatalogAnimeId(doc) {
  return String(doc?.id ?? "").startsWith("anime_");
}

/** TMDB TV rows in Mongo use numeric ids (or string digits only), not `anime_*`. */
export function isTmdbNumericTvId(doc) {
  const id = doc?.id;
  if (typeof id === "number" && Number.isFinite(id) && id > 0) return true;
  if (typeof id === "string" && /^[1-9]\d*$/.test(id.trim())) return true;
  return false;
}

/** Row produced by scripts/import-anime-to-tv.js (mapAnimeToTvDoc). */
export function isJikanAnimeImport(doc) {
  if (doc?.source !== "jikan") return false;
  const mal = doc.mal_id;
  if (typeof mal === "number" && Number.isFinite(mal) && mal > 0) return true;
  if (typeof mal === "string" && /^[1-9]\d*$/.test(String(mal).trim())) return true;
  return false;
}

export function hasAnimeTag(doc) {
  const tags = doc?.tags;
  if (!Array.isArray(tags)) return false;
  return tags.some((t) => String(t).toLowerCase() === "anime");
}

export function isJapaneseOrigin(doc) {
  const oc = doc?.origin_country;
  if (Array.isArray(oc) && oc.some((c) => String(c).toUpperCase() === "JP")) return true;
  if (doc?.original_language === "ja") return true;
  return false;
}

/** TMDB `genre_ids` / `genres` animation (pre–genre-purge). */
export function hasAnimationGenreCore(doc) {
  const gids = doc?.genre_ids;
  if (Array.isArray(gids) && gids.includes(TMDB_ANIMATION_GENRE_ID)) return true;

  const genres = doc?.genres;
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

/** IMDb / OMDb animation label (post–genre-purge catalog rows). */
export function hasAnimationGenreFromImdb(doc) {
  const genres = doc?.imdb_genres;
  if (
    Array.isArray(genres) &&
    genres.some((g) => String(g).trim().toLowerCase() === "animation")
  ) {
    return true;
  }
  const omdb = doc?.omdb?.genre;
  if (typeof omdb === "string" && /(^|,\s*)animation(\s*,|$)/i.test(omdb.trim())) {
    return true;
  }
  return false;
}

export function hasAnimationGenre(doc) {
  return hasAnimationGenreCore(doc) || hasAnimationGenreFromImdb(doc);
}

/**
 * Anime-like catalog row: explicit flag/tag, or JP (or ja audio) + animation genre.
 * Does not treat US cartoons as anime unless is_anime / anime tag is set.
 */
export function isAnimeLike(doc) {
  if (doc?.is_anime === true) return true;
  if (hasAnimeTag(doc)) return true;
  if (isJapaneseOrigin(doc) && hasAnimationGenre(doc)) return true;
  return false;
}

/** Legacy “anime” TV from TMDB sync: Japan + animation genre, not the Jikan pipeline. */
export function isOldCatalogJpAnimationTv(doc) {
  return isJapaneseOrigin(doc) && hasAnimationGenre(doc);
}

/**
 * TMDB sync sometimes drops genre arrays; JP/ja + both TMDB genre arrays empty
 * still matches many legacy anime rows (e.g. id 1429).
 */
export function isJapaneseOriginWithNoGenreData(doc) {
  if (!isJapaneseOrigin(doc)) return false;
  const gids = doc?.genre_ids;
  const genres = doc?.genres;
  const gidsEmpty = !Array.isArray(gids) || gids.length === 0;
  const genresEmpty = !Array.isArray(genres) || genres.length === 0;
  return gidsEmpty && genresEmpty;
}

/**
 * @param {Record<string, unknown>} doc - TV row or Mongo doc (must include type: "tv" when from DB)
 */
export function shouldPruneTvAnimeWithoutAnilist(doc) {
  // Anime is allowed. We no longer block Japanese-origin animated TV that comes
  // from TMDB (numeric ids) — it used to trip the "community guidelines" screen.
  // Genuinely adult content is still gated via `adult === true` in
  // showUnavailableReasonForDoc, independent of this function.
  return false;
}

export const SHOW_UNAVAILABLE_MESSAGES = {
  content_policy:
    "This content doesn't meet our community guidelines. We work to keep the platform safe and enjoyable for everyone.",
  not_found: "This show isn't in our catalog right now.",
};

/** Why a show page could not be loaded (for blocked / missing catalog rows). */
export function showUnavailableReasonForDoc(doc) {
  if (!doc || typeof doc !== "object") return "not_found";
  if (doc.adult === true) return "content_policy";
  if (isBlockedAdultAnimeDoc(doc)) return "content_policy";
  if (shouldPruneTvAnimeWithoutAnilist(doc)) return "content_policy";
  return "not_found";
}

/** @deprecated */
export const shouldPruneTvJpAnimeWithoutAnilist = shouldPruneTvAnimeWithoutAnilist;

/**
 * Mongo clause: hide numeric TMDB JP animation from TV Shows browse/search (not `anime_*`).
 * @returns {Record<string, unknown>}
 */
export function catalogExcludeJpAnimationNumericTvMongoClause() {
  const numericTmdbTv = {
    $and: [
      {
        $expr: {
          $regexMatch: {
            input: { $toString: "$id" },
            regex: "^[1-9]\\d*$",
          },
        },
      },
      { $nor: [{ is_anime: true }, { tags: "anime" }] },
      { source: { $ne: "jikan" } },
    ],
  };

  const jpOrigin = {
    $or: [{ origin_country: "JP" }, { original_language: "ja" }],
  };

  const animationGenre = {
    $or: [
      { genre_ids: TMDB_ANIMATION_GENRE_ID },
      { genres: { $elemMatch: { id: TMDB_ANIMATION_GENRE_ID } } },
      { genres: { $elemMatch: { name: { $regex: /^animation$/i } } } },
      { imdb_genres: { $regex: /^Animation$/i } },
      { "omdb.genre": { $regex: /(^|,\s*)Animation(\s*,|$)/i } },
    ],
  };

  const emptyTmdbGenres = {
    $and: [
      {
        $or: [
          { genre_ids: { $exists: false } },
          { genre_ids: null },
          { genre_ids: [] },
        ],
      },
      {
        $or: [
          { genres: { $exists: false } },
          { genres: null },
          { genres: [] },
        ],
      },
    ],
  };

  return {
    $nor: [
      { $and: [numericTmdbTv, jpOrigin, animationGenre] },
      { $and: [numericTmdbTv, jpOrigin, emptyTmdbGenres] },
    ],
  };
}
