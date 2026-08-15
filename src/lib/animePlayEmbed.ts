/** MegaPlay anime embed — https://megaplay.buzz/ (animeplay.cfd mirror is suspended). */
export const MEGAPLAY_EMBED_BASE = "https://megaplay.buzz";

/** @deprecated alias — use MEGAPLAY_EMBED_BASE */
export const ANIMEPLAY_BASE = MEGAPLAY_EMBED_BASE;

export type AnimeAudioLanguage = "sub" | "dub";

export const ANIME_AUDIO_OPTIONS: AnimeAudioLanguage[] = ["sub", "dub"];

export function animeAudioLabel(language: AnimeAudioLanguage): string {
  return language === "dub" ? "Dub" : "Sub";
}

/** Rewrite suspended / legacy animeplay.cfd hosts to MegaPlay. */
export function normalizeMegaPlayEmbedHost(url: string): string {
  return String(url ?? "").replace(/^https?:\/\/animeplay\.cfd/i, MEGAPLAY_EMBED_BASE);
}

/**
 * Catalog episode id from Anikoto `/series/{id}` (`episode_embed_id`).
 * https://megaplay.buzz/stream/s-2/{id}/{language}
 */
export function buildMegaPlayCatalogEmbedUrl(
  episodeEmbedId: string | number,
  language: AnimeAudioLanguage
): string {
  const id = String(episodeEmbedId ?? "").trim();
  const lang = language === "dub" ? "dub" : "sub";
  if (!id) return "";
  return `${MEGAPLAY_EMBED_BASE}/stream/s-2/${encodeURIComponent(id)}/${lang}`;
}

/**
 * AniList route: `https://megaplay.buzz/stream/ani/{anilist-id}/{ep-num}/{language}`
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
  return `${MEGAPLAY_EMBED_BASE}/stream/ani/${id}/${ep}/${lang}`;
}

/**
 * MAL route: `https://megaplay.buzz/stream/mal/{mal-id}/{ep-num}/{language}`
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
  return `${MEGAPLAY_EMBED_BASE}/stream/mal/${id}/${ep}/${lang}`;
}

/** MegaPlay AniList routes are unreliable — prefer MAL URLs. */
export function isMegaPlayAnilistEmbedUrl(url: string): boolean {
  return /megaplay\.buzz\/stream\/ani\/\d+/i.test(String(url ?? ""));
}

/**
 * Drop broken hosts and normalize MegaPlay mirrors.
 */
export function sanitizeAnimeEmbedUrl(url: string | null | undefined): string | null {
  const u = normalizeMegaPlayEmbedHost(typeof url === "string" ? url.trim() : "");
  if (!u.startsWith("http")) return null;
  if (/animeplay\.cfd/i.test(u)) return null;
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
