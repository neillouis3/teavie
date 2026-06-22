/**
 * Unified IMDb / OMDb genre labels (same taxonomy for movies and TV).
 * `imdb_genres` is the canonical genre field on catalog docs — TMDB `genre_ids`
 * and `genres` are not stored after normalization.
 */

/** @typedef {{ slug: string; label: string }} ImdbGenre */

/** @type {ImdbGenre[]} */
export const IMDB_GENRES = [
  { slug: "action", label: "Action" },
  { slug: "adventure", label: "Adventure" },
  { slug: "animation", label: "Animation" },
  { slug: "biography", label: "Biography" },
  { slug: "comedy", label: "Comedy" },
  { slug: "crime", label: "Crime" },
  { slug: "documentary", label: "Documentary" },
  { slug: "drama", label: "Drama" },
  { slug: "family", label: "Family" },
  { slug: "fantasy", label: "Fantasy" },
  { slug: "history", label: "History" },
  { slug: "horror", label: "Horror" },
  { slug: "music", label: "Music" },
  { slug: "musical", label: "Musical" },
  { slug: "mystery", label: "Mystery" },
  { slug: "romance", label: "Romance" },
  { slug: "sci-fi", label: "Sci-Fi" },
  { slug: "sport", label: "Sport" },
  { slug: "thriller", label: "Thriller" },
  { slug: "war", label: "War" },
  { slug: "western", label: "Western" },
  { slug: "film-noir", label: "Film-Noir" },
  { slug: "game-show", label: "Game-Show" },
  { slug: "news", label: "News" },
  { slug: "reality-tv", label: "Reality-TV" },
  { slug: "talk-show", label: "Talk-Show" },
];

/** @type {{ slug: string; label: string; href: string }[]} */
export const IMDB_CATEGORIES = [
  { slug: "kdrama", label: "Korean Drama", href: "/kdrama" },
];

const IMDB_SLUG_TO_LABEL = new Map(IMDB_GENRES.map((g) => [g.slug, g.label]));
const IMDB_LABEL_TO_SLUG = new Map(
  IMDB_GENRES.map((g) => [g.label.toLowerCase(), g.slug])
);

/** TMDB genre name → IMDb-style label. */
const TMDB_NAME_TO_IMDB = {
  "action & adventure": "Action",
  action: "Action",
  adventure: "Adventure",
  animation: "Animation",
  comedy: "Comedy",
  crime: "Crime",
  documentary: "Documentary",
  drama: "Drama",
  family: "Family",
  fantasy: "Fantasy",
  history: "History",
  horror: "Horror",
  music: "Music",
  mystery: "Mystery",
  romance: "Romance",
  "science fiction": "Sci-Fi",
  "sci-fi & fantasy": "Sci-Fi",
  thriller: "Thriller",
  war: "War",
  "war & politics": "War",
  western: "Western",
  kids: "Family",
  reality: "Reality-TV",
  "reality-tv": "Reality-TV",
  news: "News",
  "game-show": "Game-Show",
  "game show": "Game-Show",
  "talk-show": "Talk-Show",
  "talk show": "Talk-Show",
  talk: "Talk-Show",
  "film-noir": "Film-Noir",
  "film noir": "Film-Noir",
  soap: "Drama",
  "tv movie": "Drama",
};

/** TMDB genre id → display name (movie + tv combined). */
const TMDB_ID_TO_NAME = {
  28: "Action",
  12: "Adventure",
  16: "Animation",
  35: "Comedy",
  80: "Crime",
  99: "Documentary",
  18: "Drama",
  10751: "Family",
  14: "Fantasy",
  36: "History",
  27: "Horror",
  10402: "Music",
  9648: "Mystery",
  10749: "Romance",
  878: "Science Fiction",
  10770: "TV Movie",
  53: "Thriller",
  10752: "War",
  37: "Western",
  10759: "Action & Adventure",
  10762: "Kids",
  10763: "News",
  10764: "Reality",
  10765: "Sci-Fi & Fantasy",
  10766: "Soap",
  10767: "Talk",
  10768: "War & Politics",
};

/** Anime / AniList genre strings → IMDb label (null = skip). */
const ANIME_GENRE_TO_IMDB = {
  action: "Action",
  adventure: "Adventure",
  comedy: "Comedy",
  drama: "Drama",
  fantasy: "Fantasy",
  horror: "Horror",
  mystery: "Mystery",
  romance: "Romance",
  "sci-fi": "Sci-Fi",
  "science fiction": "Sci-Fi",
  thriller: "Thriller",
  sports: "Sport",
  sport: "Sport",
  music: "Music",
  historical: "History",
  history: "History",
  supernatural: "Fantasy",
  suspense: "Thriller",
  psychological: "Thriller",
  mecha: "Action",
  military: "War",
  samurai: "Action",
  "martial arts": "Action",
  kids: "Family",
  family: "Family",
  "slice of life": "Drama",
  school: "Drama",
  seinen: "Drama",
  shounen: "Action",
  shoujo: "Romance",
  josei: "Drama",
  ecchi: null,
  harem: null,
  isekai: "Fantasy",
  demons: "Horror",
  vampire: "Horror",
  police: "Crime",
  crime: "Crime",
  detective: "Mystery",
  space: "Sci-Fi",
  cyberpunk: "Sci-Fi",
  dystopian: "Sci-Fi",
};

/**
 * @param {string} raw
 * @returns {string | null}
 */
function imdbLabelFromRawGenreName(raw) {
  const name = String(raw ?? "").trim();
  if (!name) return null;
  const key = name.toLowerCase();
  if (ANIME_GENRE_TO_IMDB[key] === null) return null;
  if (ANIME_GENRE_TO_IMDB[key]) return ANIME_GENRE_TO_IMDB[key];
  if (TMDB_NAME_TO_IMDB[key]) return TMDB_NAME_TO_IMDB[key];
  const direct = IMDB_GENRES.find((g) => g.label.toLowerCase() === key);
  if (direct) return direct.label;
  // Keep valid OMDb-style labels even when not in the browse dropdown.
  if (/^[a-z]+(-[a-z]+)*$/i.test(name.replace(/\s+/g, "-"))) return name;
  return null;
}

/**
 * @param {string | null | undefined} genreRaw OMDb `Genre` field
 * @returns {string[]}
 */
export function parseImdbGenresFromOmdb(genreRaw) {
  if (typeof genreRaw !== "string" || !genreRaw.trim() || genreRaw === "N/A") {
    return [];
  }
  return [
    ...new Set(
      genreRaw
        .split(",")
        .map((g) => imdbLabelFromRawGenreName(g.trim()))
        .filter(Boolean)
    ),
  ];
}

/**
 * @param {string | null | undefined} slug
 * @returns {string | null}
 */
export function imdbGenreLabelFromSlug(slug) {
  const s = String(slug ?? "").trim().toLowerCase();
  if (!s) return null;
  return IMDB_SLUG_TO_LABEL.get(s) ?? null;
}

/**
 * @param {string | null | undefined} label
 * @returns {string | null}
 */
export function imdbGenreSlugFromLabel(label) {
  const key = String(label ?? "").trim().toLowerCase();
  if (!key) return null;
  return IMDB_LABEL_TO_SLUG.get(key) ?? null;
}

/** Legacy TMDB genre id → IMDb browse slug. */
const TMDB_ID_TO_IMDB_SLUG = new Map(
  Object.entries(TMDB_ID_TO_NAME).map(([id, name]) => {
    const label = imdbLabelFromRawGenreName(name);
    const slug = label ? imdbGenreSlugFromLabel(label) : null;
    return slug ? [Number(id), slug] : null;
  }).filter(Boolean)
);

/**
 * Normalize a browse/search `genre` query param (slug, label, or legacy TMDB id).
 * @param {string | null | undefined} param
 * @returns {string | null} IMDb slug
 */
export function imdbGenreSlugFromBrowseParam(param) {
  const raw = String(param ?? "").trim();
  if (!raw) return null;
  const lower = raw.toLowerCase();
  if (IMDB_SLUG_TO_LABEL.has(lower)) return lower;
  const fromLabel = imdbGenreSlugFromLabel(raw);
  if (fromLabel) return fromLabel;
  if (/^\d+$/.test(raw)) {
    return TMDB_ID_TO_IMDB_SLUG.get(parseInt(raw, 10)) ?? null;
  }
  const fromRaw = imdbLabelFromRawGenreName(raw);
  if (fromRaw) return imdbGenreSlugFromLabel(fromRaw);
  return null;
}

/**
 * @param {string | null | undefined} param
 * @returns {string | null} canonical IMDb genre label for Mongo filters
 */
export function imdbGenreLabelFromBrowseParam(param) {
  const slug = imdbGenreSlugFromBrowseParam(param);
  if (slug) return imdbGenreLabelFromSlug(slug);
  return imdbLabelFromRawGenreName(param);
}

/**
 * Canonical href for a genre landing page.
 * @param {string | null | undefined} slugOrParam
 * @param {{ type?: "movie" | "tv" | "anime" | "kdrama"; sortBy?: string }} [opts]
 */
export function genrePageHref(slugOrParam, opts = {}) {
  const slug = imdbGenreSlugFromBrowseParam(slugOrParam) ?? null;
  if (!slug) return "/genres";
  const params = new URLSearchParams();
  const type = opts.type ?? "all";
  if (type !== "all") params.set("type", type);

  let sort = opts.sort ?? opts.sortBy ?? "popular";
  if (sort === "popularity") sort = "popular";
  if (sort === "release_year") sort = "new";
  if (sort === "vote_average") sort = "top_rated";
  if (sort !== "popular") params.set("sort", sort);

  const qs = params.toString();
  return qs ? `/genre/${slug}?${qs}` : `/genre/${slug}`;
}

/**
 * @param {string | null | undefined} slug
 * @returns {boolean}
 */
export function isValidImdbGenreSlug(slug) {
  const s = String(slug ?? "").trim().toLowerCase();
  return Boolean(s && IMDB_SLUG_TO_LABEL.has(s));
}

/**
 * @param {number[] | undefined} genreIds
 * @returns {string[]}
 */
export function imdbGenresFromTmdbGenreIds(genreIds) {
  if (!Array.isArray(genreIds)) return [];
  const out = [];
  for (const id of genreIds) {
    const n = Number(id);
    if (!Number.isFinite(n)) continue;
    const tmdbName = TMDB_ID_TO_NAME[n];
    if (!tmdbName) continue;
    const mapped = imdbLabelFromRawGenreName(tmdbName);
    if (mapped) out.push(mapped);
  }
  return [...new Set(out)];
}

/**
 * @param {{ name?: string }[] | undefined} tmdbGenres
 * @returns {string[]}
 */
export function imdbGenresFromTmdbGenres(tmdbGenres) {
  if (!Array.isArray(tmdbGenres)) return [];
  const out = [];
  for (const g of tmdbGenres) {
    const mapped = imdbLabelFromRawGenreName(g?.name);
    if (mapped) out.push(mapped);
  }
  return [...new Set(out)];
}

/**
 * @param {Record<string, unknown>} doc
 * @returns {string[]}
 */
export function imdbGenresFromAnimeSources(doc) {
  const names = [];
  if (Array.isArray(doc.genres)) {
    for (const g of doc.genres) {
      if (typeof g === "string") names.push(g);
      else if (g && typeof g === "object" && g.name) names.push(String(g.name));
    }
  }
  const anilist = doc.anilist;
  if (anilist && typeof anilist === "object" && Array.isArray(anilist.genres)) {
    for (const g of anilist.genres) names.push(String(g));
  }
  const out = [];
  for (const n of names) {
    const mapped = imdbLabelFromRawGenreName(n);
    if (mapped) out.push(mapped);
  }
  const idStr = String(doc.id ?? "");
  if (idStr.startsWith("anime_") || doc.is_anime === true) {
    if (!out.includes("Animation")) out.push("Animation");
  }
  return [...new Set(out)];
}

/**
 * Merge all known sources into canonical IMDb genre labels.
 * @param {Record<string, unknown>} doc
 * @returns {string[]}
 */
export function imdbGenresForDoc(doc) {
  const fromStored = Array.isArray(doc.imdb_genres)
    ? doc.imdb_genres
        .map((g) => imdbLabelFromRawGenreName(String(g)))
        .filter(Boolean)
    : [];
  const omdb = doc.omdb;
  const fromOmdb =
    omdb && typeof omdb === "object"
      ? parseImdbGenresFromOmdb(/** @type {{ genre?: string }} */ (omdb).genre)
      : [];
  const fromTmdbObjects = imdbGenresFromTmdbGenres(
    /** @type {{ name?: string }[]} */ (doc.genres)
  );
  const fromTmdbIds = imdbGenresFromTmdbGenreIds(
    /** @type {number[]} */ (doc.genre_ids)
  );
  const fromAnime = imdbGenresFromAnimeSources(doc);
  return [
    ...new Set([
      ...fromStored,
      ...fromOmdb,
      ...fromTmdbObjects,
      ...fromTmdbIds,
      ...fromAnime,
    ]),
  ];
}

/**
 * @param {string} label
 * @returns {Record<string, unknown>}
 */
export function imdbGenreMatchConditions(label) {
  const safe = String(label).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const rx = new RegExp(`(^|,\\s*)${safe}(\\s*,|$)`, "i");
  return {
    $or: [
      { imdb_genres: label },
      { imdb_genres: { $regex: `^${safe}$`, $options: "i" } },
      { "omdb.genre": { $regex: rx } },
    ],
  };
}

/**
 * Whether a catalog doc should be treated as K-Drama (Korean TV, non-anime).
 * @param {Record<string, unknown>} doc
 * @returns {boolean}
 */
export function isKdramaDoc(doc) {
  if (!doc || typeof doc !== "object") return false;
  if (doc.type !== "tv") return false;

  const idStr = String(doc.id ?? "");
  if (idStr.startsWith("anime_") || doc.is_anime === true) return false;

  const categories = doc.catalog_categories;
  if (Array.isArray(categories) && categories.includes("kdrama")) return true;
  if (doc.is_kdrama === true) return true;

  const origins = doc.origin_country;
  const hasKr =
    (Array.isArray(origins) &&
      origins.some((c) => String(c).toUpperCase() === "KR")) ||
    String(origins ?? "").toUpperCase() === "KR";

  const omdb =
    doc.omdb && typeof doc.omdb === "object"
      ? /** @type {{ country?: string; language?: string }} */ (doc.omdb)
      : null;
  const koreanCountry =
    hasKr || (omdb?.country ? /korea/i.test(String(omdb.country)) : false);

  const lang = String(doc.original_language ?? "").toLowerCase();
  const koreanLang =
    lang === "ko" ||
    (omdb?.language ? /korean/i.test(String(omdb.language)) : false);

  return koreanCountry && koreanLang;
}

/**
 * Fields to set when tagging a row as K-Drama.
 * @param {Record<string, unknown>} doc
 * @returns {Record<string, unknown>}
 */
export function kdramaTagFields(doc) {
  const imdb_genres = imdbGenresForDoc(doc);
  const categories = new Set(
    Array.isArray(doc.catalog_categories) ? doc.catalog_categories : []
  );
  categories.add("kdrama");
  if (!imdb_genres.includes("Drama")) {
    imdb_genres.unshift("Drama");
  }
  return {
    imdb_genres,
    catalog_categories: [...categories],
    is_kdrama: true,
  };
}

/**
 * Normalize a catalog doc for Mongo writes: set `imdb_genres`, strip TMDB genre fields.
 * @param {Record<string, unknown>} doc
 * @returns {Record<string, unknown>}
 */
export function applyImdbGenresToCatalogDoc(doc) {
  const imdb_genres = imdbGenresForDoc(doc);
  /** @type {Record<string, unknown>} */
  const next = { ...doc, imdb_genres };
  delete next.genre_ids;
  delete next.genres;
  if (isKdramaDoc(next)) {
    Object.assign(next, kdramaTagFields(next));
  }
  return next;
}

/**
 * Mongo update payload: $set imdb_genres (+ kdrama tags), $unset TMDB genre fields.
 * @param {Record<string, unknown>} doc
 * @returns {{ set: Record<string, unknown>; unset: Record<string, string> }}
 */
export function catalogGenreMongoPatch(doc) {
  const merged = applyImdbGenresToCatalogDoc({ ...doc });
  /** @type {Record<string, unknown>} */
  const set = { imdb_genres: merged.imdb_genres };
  if (merged.is_kdrama === true) {
    set.is_kdrama = true;
    set.catalog_categories = merged.catalog_categories;
  }
  return {
    set,
    unset: { genre_ids: "", genres: "" },
  };
}

/**
 * Display genre names for cards/rails (from canonical `imdb_genres`).
 * @param {Record<string, unknown> | null | undefined} doc
 * @param {number} [max]
 * @returns {string[]}
 */
export function genreNamesFromDoc(doc, max = 2) {
  if (!doc || typeof doc !== "object") return [];
  const labels = Array.isArray(doc.imdb_genres)
    ? doc.imdb_genres.map((g) => String(g).trim()).filter(Boolean)
    : imdbGenresForDoc(doc);
  return labels.slice(0, max);
}
