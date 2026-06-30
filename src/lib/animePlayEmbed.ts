/** MegaPlay anime embed — https://animeplay.cfd/ */
export const ANIMEPLAY_BASE = "https://animeplay.cfd";

export type AnimeAudioLanguage = "sub" | "dub";

export const ANIME_AUDIO_OPTIONS: AnimeAudioLanguage[] = ["sub", "dub"];

export function animeAudioLabel(language: AnimeAudioLanguage): string {
  return language === "dub" ? "Dub" : "Sub";
}

/**
 * AniList route: `https://animeplay.cfd/stream/ani/{anilist-id}/{ep-num}/{language}`
 */
export function buildAnimePlayAniListUrl(
  anilistId: number,
  episode: number,
  language: AnimeAudioLanguage
): string {
  const id = Math.floor(Number(anilistId));
  const ep = Math.max(1, Math.floor(Number(episode)) || 1);
  const lang = language === "dub" ? "dub" : "sub";
  if (!Number.isFinite(id) || id <= 0) return "";
  return `${ANIMEPLAY_BASE}/stream/ani/${id}/${ep}/${lang}`;
}

/**
 * MAL route: `https://animeplay.cfd/stream/mal/{mal-id}/{ep-num}/{language}`
 */
export function buildAnimePlayMalUrl(
  malId: number,
  episode: number,
  language: AnimeAudioLanguage
): string {
  const id = Math.floor(Number(malId));
  const ep = Math.max(1, Math.floor(Number(episode)) || 1);
  const lang = language === "dub" ? "dub" : "sub";
  if (!Number.isFinite(id) || id <= 0) return "";
  return `${ANIMEPLAY_BASE}/stream/mal/${id}/${ep}/${lang}`;
}

/** Legacy megaplay.buzz AniList routes 410 — animeplay.cfd ani routes are OK. */
export function isMegaPlayAnilistEmbedUrl(url: string): boolean {
  return /megaplay\.buzz\/stream\/ani\/\d+/i.test(String(url ?? ""));
}

/**
 * Drop broken MegaPlay AniList embeds; callers should use MAL URLs instead.
 */
export function sanitizeAnimeEmbedUrl(url: string | null | undefined): string | null {
  const u = typeof url === "string" ? url.trim() : "";
  if (!u.startsWith("http")) return null;
  if (isMegaPlayAnilistEmbedUrl(u)) return null;
  return u;
}

/** Optional resume offset (seconds) for MegaPlay embed URLs. */
export function withMegaPlayStartTime(
  url: string | null | undefined,
  seconds: number
): string | null {
  const base = sanitizeAnimeEmbedUrl(url);
  if (!base) return null;
  const sec = Math.floor(Number(seconds));
  if (!Number.isFinite(sec) || sec <= 0) return base;
  try {
    const parsed = new URL(base);
    parsed.searchParams.set("start", String(sec));
    return parsed.toString();
  } catch {
    const join = base.includes("?") ? "&" : "?";
    return `${base}${join}start=${sec}`;
  }
}
