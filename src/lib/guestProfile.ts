import { getStoredPartyNickname, setStoredPartyNickname } from "@/lib/partyNickname";

export const GUEST_AVATAR_KEY = "teavie:guest-avatar:v1";
export const GUEST_AVATAR_CHANGED_EVENT = "teavie-guest-avatar-changed";

export function loadGuestAvatarUrl(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(GUEST_AVATAR_KEY);
  } catch {
    return null;
  }
}

export function saveGuestAvatarUrl(url: string | null): void {
  if (typeof window === "undefined") return;
  try {
    if (url) localStorage.setItem(GUEST_AVATAR_KEY, url);
    else localStorage.removeItem(GUEST_AVATAR_KEY);
    window.dispatchEvent(new CustomEvent(GUEST_AVATAR_CHANGED_EVENT));
  } catch {
    /* quota / private mode */
  }
}

export function loadGuestDisplayName(): string {
  return getStoredPartyNickname();
}

export function saveGuestDisplayName(name: string): void {
  setStoredPartyNickname(name.trim().slice(0, 64) || "Guest");
}
