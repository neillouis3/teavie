/**
 * Drop low-signal K-Drama catalog rows: TMDB stubs, variety specials, web shorts, missing art.
 */

import { TMDB_ANIMATION_GENRE_ID } from "./tvJpAnimePrune.js";

/** @param {unknown} value */
function hasNonEmptyPath(value) {
  return typeof value === "string" && value.trim().length > 0;
}

/** @param {unknown} doc */
export function isKdramaTagged(doc) {
  if (!doc || typeof doc !== "object") return false;
  const d = /** @type {Record<string, unknown>} */ (doc);
  if (d.is_kdrama === true) return true;
  const cats = d.catalog_categories;
  return Array.isArray(cats) && cats.includes("kdrama");
}

/** @param {unknown} title */
export function isKdramaJunkTitle(title) {
  const t = String(title ?? "").trim();
  if (!t) return true;
  return KDRAMA_JUNK_TITLE_PATTERNS.some((re) => re.test(t));
}

/** @param {unknown} doc */
export function isMissingKdramaArt(doc) {
  if (!doc || typeof doc !== "object") return true;
  const d = /** @type {Record<string, unknown>} */ (doc);
  return !hasNonEmptyPath(d.poster_path) && !hasNonEmptyPath(d.backdrop_path);
}

/** @param {unknown} doc */
export function isKdramaJunkDoc(doc) {
  if (!isKdramaTagged(doc)) return false;
  if (isKdramaJunkTitle(doc?.title ?? doc?.name)) return true;
  return isMissingKdramaArt(doc);
}

/** @param {unknown} doc */
export function isWesternAnimationKdramaLeak(doc) {
  if (!doc || typeof doc !== "object") return false;
  const d = /** @type {Record<string, unknown>} */ (doc);
  if (d.type && d.type !== "tv") return false;

  const western = westernOriginMongo.$or.some((clause) => {
    if ("origin_country" in clause) {
      const origins = d.origin_country;
      const codes = Array.isArray(origins)
        ? origins.map((c) => String(c).toUpperCase())
        : [String(origins ?? "").toUpperCase()];
      const allowed = /** @type {{ $in: string[] }} */ (clause.origin_country).$in;
      return codes.some((code) => allowed.includes(code));
    }
    if ("omdb.country" in clause) {
      const country = d.omdb && typeof d.omdb === "object"
        ? String(/** @type {{ country?: unknown }} */ (d.omdb).country ?? "")
        : "";
      return /** @type {{ $regex: RegExp }} */ (clause["omdb.country"]).$regex.test(country);
    }
    return false;
  });

  if (!western) return false;

  const genres = d.imdb_genres;
  if (Array.isArray(genres) && genres.some((g) => String(g).trim().toLowerCase() === "animation")) {
    return true;
  }
  const omdbGenre =
    d.omdb && typeof d.omdb === "object"
      ? String(/** @type {{ genre?: unknown }} */ (d.omdb).genre ?? "")
      : "";
  if (/(^|,\s*)animation(\s*,|$)/i.test(omdbGenre)) return true;

  const tmdbGenres = d.genres;
  if (
    Array.isArray(tmdbGenres) &&
    tmdbGenres.some(
      (g) =>
        g &&
        typeof g === "object" &&
        (/** @type {{ id?: number; name?: string }} */ (g).id === TMDB_ANIMATION_GENRE_ID ||
          String(/** @type {{ name?: string }} */ (g).name ?? "").toLowerCase() === "animation")
    )
  ) {
    return true;
  }

  const genreIds = d.genre_ids;
  return Array.isArray(genreIds) && genreIds.includes(TMDB_ANIMATION_GENRE_ID);
}

/** @param {unknown} show TMDB list/detail row before upsert */
export function shouldRejectKdramaFromCatalog(show) {
  if (!show || typeof show !== "object") return true;
  const s = /** @type {Record<string, unknown>} */ (show);
  if (isWesternAnimationKdramaLeak(s)) return true;
  if (isKdramaJunkTitle(s.name ?? s.title)) return true;
  if (isMissingKdramaArt(s)) return true;
  return false;
}

export const KDRAMA_JUNK_TITLE_PATTERNS = [
  /^\d{4}\s/i,
  /\b20\d{2}\b.*(Festival|Olympics|Wrestling|Contest|Special|Nomination|Dimf|KPOP|Bang Bang|Song Special|Mama|Idol Star|Supermodel|Gangnam|Athletics|Routine King|Sunday Special|Music Makes One|Seollal|Beijing Winter|Collab|We're HERO)/i,
  /\d+\s*cm\b/i,
  /Male Friend vs/i,
  /Friendship\s+0\.?\d+\s*cm/i,
  /^THE BEST CHOI/i,
];

export const catalogHasKdramaArtMongoClause = {
  $or: [
    { poster_path: { $type: "string", $regex: /\S/ } },
    { backdrop_path: { $type: "string", $regex: /\S/ } },
  ],
};

const missingArtMongo = {
  $and: [
    {
      $or: [
        { poster_path: null },
        { poster_path: "" },
        { poster_path: { $exists: false } },
      ],
    },
    {
      $or: [
        { backdrop_path: null },
        { backdrop_path: "" },
        { backdrop_path: { $exists: false } },
      ],
    },
  ],
};

const junkTitleMongo = {
  $or: KDRAMA_JUNK_TITLE_PATTERNS.flatMap((re) => [
    { title: re },
    { name: re },
  ]),
};

/** Rows to purge from `content` (tagged kdrama + junk). */
export function catalogKdramaJunkMongoMatch() {
  return {
    $and: [
      {
        $or: [{ catalog_categories: "kdrama" }, { is_kdrama: true }],
      },
      {
        $or: [missingArtMongo, junkTitleMongo],
      },
    ],
  };
}

/** Exclude junk rows from browse / discover queries. */
export function catalogExcludeKdramaJunkMongoClause() {
  return { $nor: [catalogKdramaJunkMongoMatch()] };
}

/** Rows explicitly categorized as K-Drama in the catalog. */
export function catalogKdramaTaggedMongoClause() {
  return {
    $or: [{ is_kdrama: true }, { catalog_categories: "kdrama" }],
  };
}

const westernOriginMongo = {
  $or: [
    {
      origin_country: {
        $in: ["US", "GB", "CA", "FR", "AU", "DE", "IT", "ES", "NL", "BE", "CH", "SE", "NO", "DK", "FI", "IE", "NZ"],
      },
    },
    {
      "omdb.country": {
        $regex:
          /United States|U\.S\.|USA|France|United Kingdom|Canada|Australia|Germany|Italy|Spain/i,
      },
    },
  ],
};

const animationGenreMongo = {
  $or: [
    { genre_ids: TMDB_ANIMATION_GENRE_ID },
    { genres: { $elemMatch: { id: TMDB_ANIMATION_GENRE_ID } } },
    { genres: { $elemMatch: { name: { $regex: /^animation$/i } } } },
    { imdb_genres: "Animation" },
    { imdb_genres: { $regex: /(^|,\s*)Animation(\s*,|$)/i } },
    { "omdb.genre": { $regex: /(^|,\s*)Animation(\s*,|$)/i } },
  ],
};

/**
 * Western cartoons (US/FR/UK + Animation) are not K-Drama even when mis-tagged or
 * given Korean dub metadata.
 */
export function catalogExcludeWesternAnimationKdramaMongoClause() {
  return { $nor: [{ $and: [westernOriginMongo, animationGenreMongo] }] };
}
