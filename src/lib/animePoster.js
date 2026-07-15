/**
 * Prefer per-season AniList/Jikan art over shared OMDb/Amazon series posters on `anime_*` rows.
 */

function pickString(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/**
 * Upgrade common low-res anime CDN URLs so widescreen spotlight/featured cards stay sharp.
 * @param {unknown} url
 * @returns {string | null}
 */
export function preferHighResAnimeImageUrl(url) {
  const raw = pickString(url);
  if (!raw) return null;
  let out = raw;

  // AniList cover/large (~460px) → extraLarge for hero/featured crops.
  out = out.replace(
    /\/media\/anime\/cover\/large\//gi,
    "/media/anime/cover/extraLarge/"
  );

  // OMDb / Amazon thumbs: SX300 is soft when blown up.
  out = out.replace(/_V1_SX\d+(?=\.)/gi, "_V1_SX1200");
  out = out.replace(/\._V1_UX\d+(?=\.)/gi, "._V1_UX1200");
  out = out.replace(/\._SX\d+_*(?=\.)/gi, "._SX1200_");

  // MAL: prefer the `l` (large) filename when a bare .jpg is stored.
  out = out.replace(
    /(cdn\.myanimelist\.net\/images\/anime\/\d+\/\d+)(?![tl]\.)(\.jpe?g)/gi,
    "$1l$2"
  );
  out = out.replace(
    /(myanimelist\.net\/images\/anime\/\d+\/\d+)(?![tl]\.)(\.jpe?g)/gi,
    "$1l$2"
  );

  return out;
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
    preferHighResAnimeImageUrl(cover.extraLarge) ||
    preferHighResAnimeImageUrl(cover.large) ||
    preferHighResAnimeImageUrl(cover.medium) ||
    null
  );
}

/** @param {unknown} doc */
function embeddedAnilistBanner(doc) {
  return preferHighResAnimeImageUrl(doc?.anilist?.bannerImage);
}

/** @param {unknown} doc */
function embeddedAnilistBackdrop(doc, posterFallback) {
  return embeddedAnilistBanner(doc) || posterFallback;
}

/**
 * @param {unknown} doc
 * @returns {string | null}
 */
export function animePosterFromDoc(doc) {
  if (!isAnimeCatalogDoc(doc)) {
    return preferHighResAnimeImageUrl(doc?.poster_path) ?? pickString(doc?.poster_path);
  }

  const fromAni = embeddedAnilistPoster(doc);
  if (fromAni) return fromAni;

  const stored = pickString(doc?.poster_path);
  if (stored && !isSharedOmdbAnimePoster(stored)) {
    return preferHighResAnimeImageUrl(stored) ?? stored;
  }
  return preferHighResAnimeImageUrl(stored) ?? stored ?? null;
}

/**
 * @param {unknown} doc
 * @returns {string | null}
 */
export function animeBackdropFromDoc(doc) {
  if (!isAnimeCatalogDoc(doc)) {
    return (
      preferHighResAnimeImageUrl(doc?.backdrop_path) ??
      pickString(doc?.backdrop_path) ??
      preferHighResAnimeImageUrl(doc?.poster_path) ??
      pickString(doc?.poster_path) ??
      null
    );
  }

  const poster = animePosterFromDoc(doc);
  const fromAni = embeddedAnilistBackdrop(doc, null);
  if (fromAni) return fromAni;

  const stored = pickString(doc?.backdrop_path);
  if (stored && !isSharedOmdbAnimePoster(stored)) {
    return preferHighResAnimeImageUrl(stored) ?? stored;
  }
  return poster ?? preferHighResAnimeImageUrl(stored) ?? stored ?? null;
}
