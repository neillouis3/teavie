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

/** MegaPlay AniList routes 410 on megaplay.buzz — never use for playback. */
export function isMegaPlayAnilistEmbedUrl(url: string): boolean {
  return /\/stream\/ani\/\d+/i.test(String(url ?? ""));
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
