/** Shared display name for watch party + profile avatar. */

export const PARTY_NICK_KEY = "teavie.party.nickname";

export function getStoredPartyNickname(): string {
  if (typeof window === "undefined") return "Guest";
  try {
    return localStorage.getItem(PARTY_NICK_KEY)?.trim() || "Guest";
  } catch {
    return "Guest";
  }
}

export function avatarInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  const s = name.trim();
  return (s.slice(0, 2) || "G").toUpperCase();
}
