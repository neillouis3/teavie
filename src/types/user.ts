import type { OnboardingAnimeAudio, OnboardingCategoryId } from "@/lib/onboardingOptions";

export type UserPreferences = {
  categories: OnboardingCategoryId[];
  genres: string[];
  languages: string[];
  anime_audio: OnboardingAnimeAudio | null;
};

export type UserProfile = {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  preferences: UserPreferences;
  onboarding_completed_at: string | null;
};

export type RemoteWatchHistoryEntry = {
  catalog_id: string;
  media_type: "movie" | "tv";
  last_season: number;
  last_episode: number;
  last_watched_at: string;
};

export type RemoteWatchLaterEntry = {
  catalog_id: string;
  media_type: "movie" | "tv";
  added_at: string;
};

export const EMPTY_USER_PREFERENCES: UserPreferences = {
  categories: [],
  genres: [],
  languages: [],
  anime_audio: null,
};

export function hasUserPreferences(prefs: UserPreferences | null | undefined): boolean {
  if (!prefs) return false;
  return (
    prefs.categories.length > 0 ||
    prefs.genres.length > 0 ||
    prefs.languages.length > 0 ||
    prefs.anime_audio != null
  );
}

export function normalizeUserPreferences(raw: unknown): UserPreferences {
  if (!raw || typeof raw !== "object") return { ...EMPTY_USER_PREFERENCES };
  const o = raw as Record<string, unknown>;
  const categories = Array.isArray(o.categories)
    ? o.categories.filter((c): c is OnboardingCategoryId => typeof c === "string")
    : [];
  const genres = Array.isArray(o.genres)
    ? o.genres.filter((g): g is string => typeof g === "string")
    : [];
  const languages = Array.isArray(o.languages)
    ? o.languages.filter((l): l is string => typeof l === "string")
    : [];
  const animeAudio = o.anime_audio;
  const anime_audio =
    animeAudio === "sub" || animeAudio === "dub" || animeAudio === "both"
      ? animeAudio
      : null;
  return { categories, genres, languages, anime_audio };
}
