import {
  EMPTY_USER_PREFERENCES,
  normalizeUserPreferences,
  type UserPreferences,
} from "@/types/user";

export const PREFERENCES_STORAGE_KEY = "teavie.preferences.v1";
export const PREFERENCES_CHANGED_EVENT = "teavie-preferences-changed";

/** Legacy guest localStorage prefs (migrated to account on sign-in). */
export function loadGuestPreferences(): UserPreferences {
  if (typeof window === "undefined") return { ...EMPTY_USER_PREFERENCES };
  try {
    const raw = localStorage.getItem(PREFERENCES_STORAGE_KEY);
    if (!raw) return { ...EMPTY_USER_PREFERENCES };
    return normalizeUserPreferences(JSON.parse(raw));
  } catch {
    return { ...EMPTY_USER_PREFERENCES };
  }
}

export function clearGuestPreferences(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(PREFERENCES_STORAGE_KEY);
  } catch {
    /* quota / private mode */
  }
}

export function notifyPreferencesChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(PREFERENCES_CHANGED_EVENT));
}
