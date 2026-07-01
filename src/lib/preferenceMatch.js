/**
 * Mongo match clauses from user onboarding preferences.
 */

import { imdbGenreLabelFromSlug } from "@/lib/imdbGenres";

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
  const categories = Array.isArray(preferences?.categories)
    ? preferences.categories.filter(Boolean)
    : [];
  const genres = Array.isArray(preferences?.genres)
    ? preferences.genres.filter(Boolean)
    : [];
  const languages = Array.isArray(preferences?.languages)
    ? preferences.languages.filter(Boolean)
    : [];

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
    const labels = [
      ...new Set(
        genres.map((slug) => imdbGenreLabelFromSlug(slug)).filter(Boolean)
      ),
    ];
    if (labels.length > 0) {
      clauses.push({ imdb_genres: { $in: labels } });
    }
  }

  if (languages.length > 0) {
    clauses.push({
      original_language: {
        $in: languages.map((l) => String(l).toLowerCase()),
      },
    });
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
