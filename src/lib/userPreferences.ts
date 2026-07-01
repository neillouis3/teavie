import {
  EMPTY_USER_PREFERENCES,
  normalizeUserPreferences,
  type UserPreferences,
} from "@/types/user";

export const PREFERENCES_STORAGE_KEY = "teavie.preferences.v1";
export const PREFERENCES_CHANGED_EVENT = "teavie-preferences-changed";

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

export function saveGuestPreferences(preferences: UserPreferences): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(preferences));
    window.dispatchEvent(new CustomEvent(PREFERENCES_CHANGED_EVENT));
  } catch {
    /* quota / private mode */
  }
}
