export const DISPLAY_NAME_KEY = "teavie.display-name";
export const DISPLAY_NAME_CHANGED_EVENT = "teavie-display-name-changed";

export function getStoredDisplayName(): string {
  if (typeof window === "undefined") return "Guest";
  try {
    const name = localStorage.getItem(DISPLAY_NAME_KEY)?.trim();
    if (name) return name;
    const legacy = localStorage.getItem("teavie.party.nickname")?.trim();
    if (legacy) {
      localStorage.setItem(DISPLAY_NAME_KEY, legacy);
      localStorage.removeItem("teavie.party.nickname");
      return legacy;
    }
    return "Guest";
  } catch {
    return "Guest";
  }
}

export function setStoredDisplayName(name: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(DISPLAY_NAME_KEY, name.trim().slice(0, 32));
    window.dispatchEvent(new CustomEvent(DISPLAY_NAME_CHANGED_EVENT));
  } catch {
    /* ignore */
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
