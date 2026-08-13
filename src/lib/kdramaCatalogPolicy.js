/**
 * Drop low-signal K-Drama catalog rows: TMDB stubs, variety specials, web shorts, missing art.
 */

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

/** @param {unknown} show TMDB list/detail row before upsert */
export function shouldRejectKdramaFromCatalog(show) {
  if (!show || typeof show !== "object") return true;
  const s = /** @type {Record<string, unknown>} */ (show);
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
