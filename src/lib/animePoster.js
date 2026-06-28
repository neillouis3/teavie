/**
 * Prefer per-season AniList/Jikan art over shared OMDb/Amazon series posters on `anime_*` rows.
 */

function pickString(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/** @param {unknown} doc */
export function isAnimeCatalogDoc(doc) {
  const isAnime =
    doc?.is_anime === true ||
    (Array.isArray(doc?.tags) && doc.tags.includes("anime")) ||
    String(doc?.id ?? "").startsWith("anime_");
  if (!isAnime) return false;
  // Mongo rows are `type: "tv"`; client Show payloads from resolve often omit `type`.
  return doc?.type == null || doc?.type === "tv";
}

/** @param {unknown} url */
export function isSharedOmdbAnimePoster(url) {
  const p = String(url ?? "").trim();
  if (!p) return false;
  return (
    /media-amazon\.com/i.test(p) ||
    /imdb\.com\/images/i.test(p) ||
    /img\.omdbapi\.com/i.test(p)
  );
}

/** @param {unknown} doc */
function embeddedAnilistPoster(doc) {
  const cover = doc?.anilist?.coverImage;
  if (!cover || typeof cover !== "object") return null;
  return (
    pickString(cover.extraLarge) ||
    pickString(cover.large) ||
    pickString(cover.medium) ||
    null
  );
}

/** @param {unknown} doc */
function embeddedAnilistBackdrop(doc, posterFallback) {
  return pickString(doc?.anilist?.bannerImage) || posterFallback;
}

/**
 * @param {unknown} doc
 * @returns {string | null}
 */
export function animePosterFromDoc(doc) {
  if (!isAnimeCatalogDoc(doc)) {
    return pickString(doc?.poster_path) ?? null;
  }

  const fromAni = embeddedAnilistPoster(doc);
  const stored = pickString(doc?.poster_path);

  if (fromAni) {
    if (!stored || stored !== fromAni || isSharedOmdbAnimePoster(stored)) return fromAni;
  }

  if (stored && !isSharedOmdbAnimePoster(stored)) return stored;
  return fromAni ?? stored ?? null;
}

/**
 * @param {unknown} doc
 * @returns {string | null}
 */
export function animeBackdropFromDoc(doc) {
  if (!isAnimeCatalogDoc(doc)) {
    return pickString(doc?.backdrop_path) ?? pickString(doc?.poster_path) ?? null;
  }

  const poster = animePosterFromDoc(doc);
  const fromAni = embeddedAnilistBackdrop(doc, poster);
  const stored = pickString(doc?.backdrop_path);

  if (fromAni) {
    if (!stored || stored !== fromAni || isSharedOmdbAnimePoster(stored)) return fromAni;
  }

  if (stored && !isSharedOmdbAnimePoster(stored)) return stored;
  return fromAni ?? stored ?? poster ?? null;
}
