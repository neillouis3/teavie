/**
 * Prefer per-season AniList/Jikan art over shared OMDb/Amazon series posters on `anime_*` rows.
 * Widescreen heroes prefer TMDB `backdrop_path` when enrichment (or storage) provides it.
 */

function pickString(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/**
 * @param {unknown} path
 * @returns {boolean}
 */
export function isTmdbImagePath(path) {
  const p = String(path ?? "").trim();
  if (!p) return false;
  if (p.startsWith("/") && !p.startsWith("//")) return true;
  return /image\.tmdb\.org\/t\/p\//i.test(p);
}

/**
 * Upgrade common low-res anime CDN URLs so widescreen spotlight/featured cards stay sharp.
 * @param {unknown} url
 * @returns {string | null}
 */
export function preferHighResAnimeImageUrl(url) {
  const raw = pickString(url);
  if (!raw) return null;
  if (isTmdbImagePath(raw)) return raw;
  let out = raw;

  // AniList's coverImage.extraLarge field already points at `/cover/large/...`.
  // Rewriting that segment to `/cover/extraLarge/` 404s — repair any broken URLs.
  out = out.replace(
    /\/media\/anime\/cover\/extraLarge\//gi,
    "/media/anime/cover/large/"
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

/**
 * @param {unknown} doc
 * @returns {string | null}
 */
export function animePosterFromDoc(doc) {
  if (!isAnimeCatalogDoc(doc)) {
    return preferHighResAnimeImageUrl(doc?.poster_path) ?? pickString(doc?.poster_path);
  }

  const storedPoster = pickString(doc?.poster_path);
  if (isTmdbImagePath(storedPoster)) return storedPoster;

  const fromAni = embeddedAnilistPoster(doc);
  if (fromAni) return fromAni;

  if (storedPoster && !isSharedOmdbAnimePoster(storedPoster)) {
    return preferHighResAnimeImageUrl(storedPoster) ?? storedPoster;
  }
  return preferHighResAnimeImageUrl(storedPoster) ?? storedPoster ?? null;
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

  const stored = pickString(doc?.backdrop_path);
  // TMDB widescreen backdrops first (from enrichment or catalog).
  if (isTmdbImagePath(stored)) return stored;

  const fromAniBanner = embeddedAnilistBanner(doc);
  if (fromAniBanner) return fromAniBanner;

  if (stored && !isSharedOmdbAnimePoster(stored) && stored !== pickString(doc?.poster_path)) {
    return preferHighResAnimeImageUrl(stored) ?? stored;
  }

  const poster = animePosterFromDoc(doc);
  return poster ?? preferHighResAnimeImageUrl(stored) ?? stored ?? null;
}

/**
 * Portrait AniList/MAL covers are soft when stretched to modal hero width.
 * @param {unknown} url
 * @returns {boolean}
 */
export function isAnimePortraitCoverUrl(url) {
  const raw = pickString(url);
  if (!raw) return false;
  if (isTmdbImagePath(raw)) return false;
  const lower = raw.toLowerCase();
  if (/\/banner\//i.test(lower)) return false;
  return /\/cover\//i.test(lower) || /\/images\/anime\/\d+\/\d+/i.test(lower);
}

/**
 * Widescreen hero art only — skips portrait poster fallbacks used on cards/rails.
 * @param {unknown} doc
 * @returns {string | null}
 */
export function animeHeroBannerFromDoc(doc) {
  if (!isAnimeCatalogDoc(doc)) {
    const stored = pickString(doc?.backdrop_path);
    if (stored && isTmdbImagePath(stored)) return stored;
    return preferHighResAnimeImageUrl(stored) ?? stored ?? null;
  }

  const stored = pickString(doc?.backdrop_path);
  if (isTmdbImagePath(stored)) return stored;

  const fromAniBanner = embeddedAnilistBanner(doc);
  if (fromAniBanner) return fromAniBanner;

  if (
    stored &&
    !isSharedOmdbAnimePoster(stored) &&
    stored !== pickString(doc?.poster_path) &&
    !isAnimePortraitCoverUrl(stored)
  ) {
    return preferHighResAnimeImageUrl(stored) ?? stored;
  }

  return null;
}

/**
 * Prefer fetched/catalog hero art over card seed posters during modal merge.
 * @param {unknown} incoming
 * @param {unknown} seedPath
 * @returns {boolean}
 */
export function shouldPreferAnimeHeroBackdrop(incoming, seedPath) {
  const inc = pickString(incoming);
  const seed = pickString(seedPath);
  if (!inc) return false;
  if (!seed || inc === seed) return Boolean(inc);
  if (isTmdbImagePath(inc) && !isTmdbImagePath(seed)) return true;
  if (!isAnimePortraitCoverUrl(inc) && isAnimePortraitCoverUrl(seed)) return true;
  if (/\/banner\//i.test(inc) && !/\/banner\//i.test(seed)) return true;
  return false;
}
