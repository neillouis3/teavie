/**
 * Mongo match clauses from user onboarding preferences.
 */

import {
  IMDB_GENRES,
  imdbGenreLabelFromSlug,
  imdbGenreMatchConditions,
  imdbGenresForDoc,
} from "@/lib/imdbGenres";
import {
  CATEGORY_LANGUAGE_CODES,
  ONBOARDING_LANGUAGES,
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
 * When genre prefs exist, every genre on the title must be selected.
 * Stops multi-genre rows (e.g. Drama + Documentary) from slipping in.
 * @param {Record<string, unknown>} doc
 * @param {import('@/types/user').UserPreferences | null | undefined} preferences
 */
export function docMatchesGenrePreferences(doc, preferences) {
  const selected = selectedGenreLabels(preferences);
  if (selected.length === 0) return true;

  const docGenres = imdbGenresForDoc(doc);
  if (docGenres.length === 0) return false;
  return docGenres.every((label) => selected.includes(label));
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

/** @param {Record<string, unknown>} doc @param {import('@/types/user').UserPreferences | null | undefined} preferences */
export function docMatchesPreferences(doc, preferences) {
  return (
    docMatchesGenrePreferences(doc, preferences) &&
    docMatchesLanguagePreferences(doc, preferences)
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
 * @param {{ type?: 'movie' | 'tv'; skipGenres?: boolean; skipCategories?: boolean }} [opts]
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
      const excludedLabels = IMDB_GENRES.map((g) => g.label).filter(
        (label) => !labels.includes(label)
      );
      if (excludedLabels.length > 0) {
        clauses.push({
          $nor: excludedLabels.map((label) => imdbGenreMatchConditions(label)),
        });
      }
    }
  }

  if (languages.length > 0) {
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
    }
  }

  if (opts.type === "movie") {
    clauses.push({ type: "movie" });
  } else if (opts.type === "tv") {
    clauses.push({ type: "tv" });
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
