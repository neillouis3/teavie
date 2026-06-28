/**
 * Anikoto API — https://anikotoapi.site/
 * Server-side only (rate limits + embed resolution).
 */

export const ANIKOTO_API_BASE = "https://anikotoapi.site";

const SERIES_CACHE_SEC = 1800;

/**
 * Fetch episode embed URL from Anikoto `/series/{anilistId}`.
 * @param {number} anilistId
 * @param {number} episode
 * @param {"sub" | "dub"} audio
 * @returns {Promise<string | null>}
 */
export async function resolveAnikotoFallbackEmbedUrl({ anilistId, episode, audio }) {
  const id = Math.floor(Number(anilistId));
  const epNum = Math.max(1, Math.floor(Number(episode)) || 1);
  if (!Number.isFinite(id) || id <= 0) return null;

  const res = await fetch(`${ANIKOTO_API_BASE}/series/${id}`, {
    headers: { accept: "application/json" },
    next: { revalidate: SERIES_CACHE_SEC },
  });
  if (!res.ok) return null;

  const payload = await res.json();
  if (!payload?.ok) return null;

  const episodes = payload?.data?.episodes;
  if (!Array.isArray(episodes)) return null;

  const row = episodes.find((e) => Number(e?.number) === epNum);
  const embeds = row?.embed_url;
  if (!embeds || typeof embeds !== "object") return null;

  const lang = audio === "dub" ? "dub" : "sub";
  const direct = embeds[lang];
  if (typeof direct === "string" && direct.startsWith("http")) return direct;
  const sub = embeds.sub;
  if (typeof sub === "string" && sub.startsWith("http")) return sub;
  const dub = embeds.dub;
  if (typeof dub === "string" && dub.startsWith("http")) return dub;
  return null;
}
