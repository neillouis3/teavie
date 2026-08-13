/**
 * Mongo match clauses from user onboarding preferences.
 */

import {
  imdbGenreLabelFromSlug,
  imdbGenreMatchConditions,
  imdbGenresForDoc,
} from "@/lib/imdbGenres";
import {
  CATEGORY_LANGUAGE_CODES,
  ONBOARDING_LANGUAGES,
  regionCodesForLanguage,
  selectedRegionCodes,
} from "@/lib/onboardingOptions";

const LANGUAGE_NAME_TO_CODE = new Map([
  ["english", "en"],
  ["korean", "ko"],
  ["japanese", "ja"],
  ["chinese", "zh"],
  ["spanish", "es"],
  ["french", "fr"],
  ["arabic", "ar"],
  ["german", "de"],
  ["hindi", "hi"],
  ["tagalog", "tl"],
  ["filipino", "tl"],
  ["thai", "th"],
  ["vietnamese", "vi"],
  ["portuguese", "pt"],
  ["italian", "it"],
]);

const COUNTRY_NAME_TO_ISO = new Map([
  ["india", "IN"],
  ["south korea", "KR"],
  ["korea", "KR"],
  ["republic of korea", "KR"],
  ["japan", "JP"],
  ["china", "CN"],
  ["taiwan", "TW"],
  ["hong kong", "HK"],
  ["macau", "MO"],
  ["philippines", "PH"],
  ["thailand", "TH"],
  ["vietnam", "VN"],
  ["united states", "US"],
  ["united states of america", "US"],
  ["usa", "US"],
  ["united kingdom", "GB"],
  ["uk", "GB"],
  ["great britain", "GB"],
  ["france", "FR"],
  ["germany", "DE"],
  ["spain", "ES"],
  ["mexico", "MX"],
  ["brazil", "BR"],
  ["portugal", "PT"],
  ["italy", "IT"],
  ["canada", "CA"],
  ["australia", "AU"],
  ["new zealand", "NZ"],
  ["ireland", "IE"],
  ["saudi arabia", "SA"],
  ["united arab emirates", "AE"],
  ["egypt", "EG"],
  ["argentina", "AR"],
  ["colombia", "CO"],
  ["chile", "CL"],
  ["peru", "PE"],
  ["venezuela", "VE"],
  ["belgium", "BE"],
  ["switzerland", "CH"],
  ["austria", "AT"],
  ["singapore", "SG"],
]);

const ISO_TO_COUNTRY_NAMES = new Map();
for (const lang of ONBOARDING_LANGUAGES) {
  for (const iso of regionCodesForLanguage(lang.code)) {
    const names = ISO_TO_COUNTRY_NAMES.get(iso) ?? new Set();
    names.add(lang.label.toLowerCase());
    ISO_TO_COUNTRY_NAMES.set(iso, names);
  }
}
for (const [name, iso] of COUNTRY_NAME_TO_ISO) {
  const names = ISO_TO_COUNTRY_NAMES.get(iso) ?? new Set();
  names.add(name);
  ISO_TO_COUNTRY_NAMES.set(iso, names);
}

/** @param {import('@/types/user').UserPreferences | null | undefined} preferences */
export function selectedLanguageCodes(preferences) {
  const languages = Array.isArray(preferences?.languages)
    ? preferences.languages.filter(Boolean)
    : [];
  return [...new Set(languages.map((code) => String(code).toLowerCase()))];
}

/**
 * @param {string} code ISO 639-1
 * @returns {string[]}
 */
function languageNameTokensForCode(code) {
  const normalized = String(code ?? "").toLowerCase().trim();
  if (!normalized) return [];

  const tokens = new Set();
  for (const [name, mapped] of LANGUAGE_NAME_TO_CODE) {
    if (mapped === normalized) tokens.add(name);
  }
  const onboarding = ONBOARDING_LANGUAGES.find((lang) => lang.code === normalized);
  if (onboarding) tokens.add(onboarding.label.toLowerCase());
  return [...tokens];
}

/**
 * Mongo match for a single catalog language (TMDB code + OMDb language names).
 * @param {string} code ISO 639-1
 */
export function catalogLanguageMatchConditions(code) {
  const normalized = String(code ?? "").toLowerCase().trim();
  const or = [{ original_language: normalized }];
  for (const name of languageNameTokensForCode(normalized)) {
    const safe = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    or.push({ "omdb.language": { $regex: `\\b${safe}\\b`, $options: "i" } });
  }
  return { $or: or };
}

/**
 * @param {string} name
 * @returns {string | null} ISO 3166-1 alpha-2
 */
function countryCodeFromName(name) {
  const lower = String(name ?? "").trim().toLowerCase();
  if (!lower) return null;
  if (/^[a-z]{2}$/i.test(lower)) return lower.toUpperCase();
  const direct = COUNTRY_NAME_TO_ISO.get(lower);
  if (direct) return direct;
  for (const [token, iso] of COUNTRY_NAME_TO_ISO) {
    if (lower.includes(token)) return iso;
  }
  return null;
}

/**
 * @param {unknown} value
 * @returns {string | null}
 */
function normalizeCountryCode(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  if (/^[A-Za-z]{2}$/.test(raw)) return raw.toUpperCase();
  return countryCodeFromName(raw);
}

/**
 * @param {string} iso ISO 3166-1 alpha-2
 * @returns {string[]}
 */
function countryNameTokensForIso(iso) {
  const code = String(iso ?? "").toUpperCase().trim();
  return [...(ISO_TO_COUNTRY_NAMES.get(code) ?? [])];
}

/**
 * Mongo match for a catalog production region.
 * @param {string} iso ISO 3166-1 alpha-2
 */
export function catalogRegionMatchConditions(iso) {
  const code = String(iso ?? "").toUpperCase().trim();
  const or = [
    { origin_country: code },
    { "production_countries.iso_3166_1": code },
  ];
  for (const name of countryNameTokensForIso(code)) {
    const safe = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    or.push({ "omdb.country": { $regex: `\\b${safe}\\b`, $options: "i" } });
  }
  return { $or: or };
}

/**
 * All ISO region codes implied by a catalog doc.
 * @param {Record<string, unknown>} doc
 * @returns {string[]}
 */
export function catalogCountryCodes(doc) {
  const codes = new Set();
  const origins = doc?.origin_country;
  if (Array.isArray(origins)) {
    for (const entry of origins) {
      const code = normalizeCountryCode(entry);
      if (code) codes.add(code);
    }
  } else {
    const code = normalizeCountryCode(origins);
    if (code) codes.add(code);
  }

  const production = doc?.production_countries;
  if (Array.isArray(production)) {
    for (const entry of production) {
      if (!entry || typeof entry !== "object") continue;
      const code = normalizeCountryCode(
        /** @type {{ iso_3166_1?: string; name?: string }} */ (entry).iso_3166_1 ??
          /** @type {{ iso_3166_1?: string; name?: string }} */ (entry).name
      );
      if (code) codes.add(code);
    }
  }

  const omdb =
    doc?.omdb && typeof doc.omdb === "object"
      ? /** @type {{ country?: string }} */ (doc.omdb)
      : null;
  const omdbCountry = String(omdb?.country ?? "").trim();
  if (omdbCountry) {
    for (const part of omdbCountry.split(",")) {
      const code = countryCodeFromName(part);
      if (code) codes.add(code);
    }
  }

  return [...codes];
}

/**
 * @param {string} token
 * @returns {string | null}
 */
function languageCodeFromToken(token) {
  const lower = String(token ?? "").trim().toLowerCase();
  if (!lower) return null;
  if (/^[a-z]{2}$/.test(lower)) return lower;
  const mapped = LANGUAGE_NAME_TO_CODE.get(lower);
  if (mapped) return mapped;
  for (const [name, code] of LANGUAGE_NAME_TO_CODE) {
    if (lower.includes(name)) return code;
  }
  const fromLabel = ONBOARDING_LANGUAGES.find(
    (lang) => lang.label.toLowerCase() === lower
  );
  return fromLabel?.code ?? null;
}

/**
 * All ISO language codes implied by a catalog doc.
 * @param {Record<string, unknown>} doc
 * @returns {string[]}
 */
export function catalogLanguageCodes(doc) {
  const codes = new Set();
  const raw = String(doc?.original_language ?? "").toLowerCase().trim();
  if (/^[a-z]{2}$/.test(raw)) codes.add(raw);

  const omdb =
    doc?.omdb && typeof doc.omdb === "object"
      ? /** @type {{ language?: string }} */ (doc.omdb)
      : null;
  const omdbLang = String(omdb?.language ?? "").trim();
  if (omdbLang) {
    for (const part of omdbLang.split(",")) {
      const code = languageCodeFromToken(part);
      if (code) codes.add(code);
    }
  }

  return [...codes];
}

/**
 * @param {Record<string, unknown>} doc
 * @returns {string | null} ISO 639-1 code
 */
export function catalogLanguageCode(doc) {
  const codes = catalogLanguageCodes(doc);
  return codes[0] ?? null;
}

/**
 * @param {string[]} categories
 * @param {string[]} languages
 */
function categoriesForLanguagePrefs(categories, languages) {
  if (languages.length === 0) return categories;

  const langSet = new Set(languages.map((code) => String(code).toLowerCase()));
  return categories.filter((category) => {
    const required = CATEGORY_LANGUAGE_CODES[category] ?? [];
    if (required.length === 0) return true;
    return required.every((code) => langSet.has(code));
  });
}

/** @param {import('@/types/user').UserPreferences | null | undefined} preferences */
export function selectedGenreLabels(preferences) {
  const genres = Array.isArray(preferences?.genres)
    ? preferences.genres.filter(Boolean)
    : [];
  return [
    ...new Set(
      genres.map((slug) => imdbGenreLabelFromSlug(slug)).filter(Boolean)
    ),
  ];
}

/**
 * Genre fit tier for ranking (lower = higher in the rail).
 * 0 = every genre on the title is selected
 * 1 = overlap, but at least one genre was not selected
 * 2 = no overlap (exclude)
 * @param {Record<string, unknown>} doc
 * @param {import('@/types/user').UserPreferences | null | undefined} preferences
 */
export function genrePreferenceTier(doc, preferences) {
  const selected = selectedGenreLabels(preferences);
  if (selected.length === 0) return 0;

  const docGenres = imdbGenresForDoc(doc);
  if (docGenres.length === 0) return 2;
  if (!docGenres.some((label) => selected.includes(label))) return 2;
  if (docGenres.every((label) => selected.includes(label))) return 0;
  return 1;
}

/**
 * When genre prefs exist, at least one genre on the title must be selected.
 * @param {Record<string, unknown>} doc
 * @param {import('@/types/user').UserPreferences | null | undefined} preferences
 */
export function docMatchesGenrePreferences(doc, preferences) {
  return genrePreferenceTier(doc, preferences) < 2;
}

/**
 * @param {Record<string, unknown>[]} docs
 * @param {import('@/types/user').UserPreferences | null | undefined} preferences
 */
export function sortDocsByGenrePreference(docs, preferences) {
  return sortDocsByPreferenceRank(docs, preferences);
}

/**
 * Region priority within selected languages (lower = higher in the rail).
 * English: US before GB, then AU, CA, NZ, IE.
 * @param {Record<string, unknown>} doc
 * @param {import('@/types/user').UserPreferences | null | undefined} preferences
 */
export function regionPreferenceRank(doc, preferences) {
  const selected = selectedLanguageCodes(preferences);
  if (selected.length === 0) return 0;

  const docCountries = catalogCountryCodes(doc);
  if (docCountries.length === 0) return 0;

  let best = Number.POSITIVE_INFINITY;
  for (const lang of selected) {
    const regions = regionCodesForLanguage(lang);
    for (const country of docCountries) {
      const idx = regions.indexOf(country);
      if (idx >= 0) best = Math.min(best, idx);
    }
  }

  return Number.isFinite(best) ? best : 0;
}

function docLikeFromContentItem(item) {
  return {
    imdb_genres: item.imdb_genres,
    omdb: item.omdb,
    original_language: item.original_language,
    origin_country: item.origin_country,
    production_countries: item.production_countries,
  };
}

/**
 * @param {Record<string, unknown>} a
 * @param {Record<string, unknown>} b
 * @param {import('@/types/user').UserPreferences | null | undefined} preferences
 */
export function preferenceRankCompare(a, b, preferences) {
  const genreDiff = genrePreferenceTier(a, preferences) - genrePreferenceTier(b, preferences);
  if (genreDiff !== 0) return genreDiff;
  return regionPreferenceRank(a, preferences) - regionPreferenceRank(b, preferences);
}

/**
 * @param {Record<string, unknown>[]} docs
 * @param {import('@/types/user').UserPreferences | null | undefined} preferences
 */
export function sortDocsByPreferenceRank(docs, preferences) {
  const hasGenre = selectedGenreLabels(preferences).length > 0;
  const hasLang = selectedLanguageCodes(preferences).length > 0;
  if (!hasGenre && !hasLang) return docs;
  return [...docs].sort((a, b) => preferenceRankCompare(a, b, preferences));
}

/**
 * @param {import('@/types/content').ContentItem[]} items
 * @param {import('@/types/user').UserPreferences | null | undefined} preferences
 */
export function sortContentItemsByGenrePreference(items, preferences) {
  return sortContentItemsByPreferenceRank(items, preferences);
}

/**
 * @param {import('@/types/content').ContentItem[]} items
 * @param {import('@/types/user').UserPreferences | null | undefined} preferences
 */
export function sortContentItemsByPreferenceRank(items, preferences) {
  const hasGenre = selectedGenreLabels(preferences).length > 0;
  const hasLang = selectedLanguageCodes(preferences).length > 0;
  if (!hasGenre && !hasLang) return items;
  return [...items].sort((a, b) =>
    preferenceRankCompare(docLikeFromContentItem(a), docLikeFromContentItem(b), preferences)
  );
}

/**
 * When language prefs exist, the title language must be one of them.
 * @param {Record<string, unknown>} doc
 * @param {import('@/types/user').UserPreferences | null | undefined} preferences
 */
export function docMatchesLanguagePreferences(doc, preferences) {
  const selected = selectedLanguageCodes(preferences);
  if (selected.length === 0) return true;

  const docCodes = catalogLanguageCodes(doc);
  if (docCodes.length === 0) return false;
  return docCodes.every((code) => selected.includes(code));
}

/**
 * When language prefs exist, production countries must map to selected language regions.
 * e.g. Hindi not selected → India (IN) titles are excluded.
 * @param {Record<string, unknown>} doc
 * @param {import('@/types/user').UserPreferences | null | undefined} preferences
 */
export function docMatchesRegionPreferences(doc, preferences) {
  const selected = selectedLanguageCodes(preferences);
  if (selected.length === 0) return true;

  const docCountries = catalogCountryCodes(doc);
  if (docCountries.length === 0) return true;

  const allowed = new Set(selectedRegionCodes(selected));
  return docCountries.every((code) => allowed.has(code));
}

/** @param {Record<string, unknown>} doc @param {import('@/types/user').UserPreferences | null | undefined} preferences */
export function docMatchesPreferences(doc, preferences) {
  return (
    docMatchesGenrePreferences(doc, preferences) &&
    docMatchesLanguagePreferences(doc, preferences) &&
    docMatchesRegionPreferences(doc, preferences)
  );
}

/**
 * Client-side preference check for mapped catalog rows (rails/cards).
 * @param {import('@/types/content').ContentItem | null | undefined} item
 * @param {import('@/types/user').UserPreferences | null | undefined} preferences
 */
export function contentItemMatchesPreferences(item, preferences) {
  if (!item || !preferences) return true;
  return docMatchesPreferences(
    {
      imdb_genres: item.imdb_genres,
      original_language: item.original_language,
      origin_country: item.origin_country,
      production_countries: item.production_countries,
      omdb: item.omdb,
    },
    preferences
  );
}

export function categoryClause(category) {
  switch (category) {
    case "movies":
      return {
        type: "movie",
        $nor: [{ id: { $regex: "^anime_" } }],
      };
    case "shows":
      return {
        type: "tv",
        is_anime: { $ne: true },
        is_kdrama: { $ne: true },
        catalog_categories: { $ne: "kdrama" },
        $nor: [{ id: { $regex: "^anime_" } }],
      };
    case "anime":
      return {
        $or: [{ id: { $regex: "^anime_" } }, { is_anime: true }],
      };
    case "kdrama":
      return {
        $or: [{ catalog_categories: "kdrama" }, { is_kdrama: true }],
      };
    case "bollywood":
      return {
        type: "movie",
        original_language: "hi",
        $nor: [{ id: { $regex: "^anime_" } }],
      };
    case "cdrama":
      return {
        type: "tv",
        original_language: "zh",
        is_anime: { $ne: true },
        is_kdrama: { $ne: true },
        catalog_categories: { $ne: "kdrama" },
        $nor: [{ id: { $regex: "^anime_" } }],
      };
    case "philippine":
      return {
        original_language: "tl",
        $nor: [{ id: { $regex: "^anime_" } }],
      };
    case "sports":
      return { imdb_genres: "Sport" };
    default:
      return null;
  }
}

/**
 * @param {import('@/types/user').UserPreferences | null | undefined} preferences
 * @param {{ type?: 'movie' | 'tv'; skipGenres?: boolean; skipCategories?: boolean; skipLanguages?: boolean }} [opts]
 */
export function buildPreferenceMatch(preferences, opts = {}) {
  const categories = categoriesForLanguagePrefs(
    Array.isArray(preferences?.categories)
      ? preferences.categories.filter(Boolean)
      : [],
    selectedLanguageCodes(preferences)
  );
  const genres = Array.isArray(preferences?.genres)
    ? preferences.genres.filter(Boolean)
    : [];
  const languages = selectedLanguageCodes(preferences);

  const clauses = [];

  if (!opts.skipCategories && categories.length > 0) {
    const categoryClauses = categories
      .map((c) => categoryClause(c))
      .filter(Boolean);
    if (categoryClauses.length > 0) {
      clauses.push({ $or: categoryClauses });
    }
  }

  if (!opts.skipGenres && genres.length > 0) {
    const labels = selectedGenreLabels(preferences);
    if (labels.length > 0) {
      clauses.push({
        $or: labels.map((label) => imdbGenreMatchConditions(label)),
      });
    }
  }

  if (!opts.skipLanguages && languages.length > 0) {
    clauses.push({
      $or: languages.map((code) => catalogLanguageMatchConditions(code)),
    });
    const excludedLanguages = ONBOARDING_LANGUAGES.map((lang) => lang.code).filter(
      (code) => !languages.includes(code)
    );
    if (excludedLanguages.length > 0) {
      clauses.push({
        $nor: excludedLanguages.map((code) => catalogLanguageMatchConditions(code)),
      });
      const excludedRegions = [
        ...new Set(
          excludedLanguages.flatMap((code) => regionCodesForLanguage(code))
        ),
      ];
      if (excludedRegions.length > 0) {
        clauses.push({
          $nor: excludedRegions.map((code) => catalogRegionMatchConditions(code)),
        });
      }
    }
  }

  if (opts.type === "movie") {
    clauses.push({ type: "movie" });
  } else if (opts.type === "tv") {
    clauses.push({ type: "tv" });
  }

  if (clauses.length === 0 && preferences?.anime_audio) {
    clauses.push(categoryClause("anime"));
  }

  if (clauses.length === 0) return null;
  return { $and: clauses };
}

/** Merge a catalog filter with an optional preference match clause. */
export function mergeWithPreferenceFilter(filter, preferences, opts = {}) {
  if (!filter) return null;
  const pref = buildPreferenceMatch(preferences, opts);
  if (!pref) return filter;
  return { $and: [filter, pref] };
}
