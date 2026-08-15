/**
 * Anikoto API — https://anikotoapi.site/
 * Server-side only (rate limits + embed resolution).
 *
 * `/series/{id}` expects the catalog `id` from `/recent-anime`, not AniList id.
 */

import {
  buildMegaPlayCatalogEmbedUrl,
  normalizeMegaPlayEmbedHost,
  sanitizeAnimeEmbedUrl,
} from "@/lib/animePlayEmbed";

export const ANIKOTO_API_BASE = "https://anikotoapi.site";

const SERIES_CACHE_SEC = 1800;
const LOOKUP_CACHE_SEC = 3600;
const MAX_LOOKUP_PAGES = 20;
const LOOKUP_PER_PAGE = 50;

async function fetchAnikotoJson(path, revalidate = SERIES_CACHE_SEC) {
  const res = await fetch(`${ANIKOTO_API_BASE}${path}`, {
    headers: { accept: "application/json" },
    next: { revalidate },
  });
  if (!res.ok) return null;
  const payload = await res.json();
  return payload?.ok ? payload : null;
}

function rowMatchesIds(row, malId, anilistId) {
  if (malId > 0 && String(row?.mal_id ?? "") === String(malId)) return true;
  if (anilistId > 0 && String(row?.ani_id ?? "") === String(anilistId)) return true;
  return false;
}

/**
 * Resolve Anikoto catalog id for `/series/{id}` via MAL / AniList ids.
 * @param {{ malId?: number, anilistId?: number }} ids
 * @returns {Promise<number | null>}
 */
export async function resolveAnikotoCatalogId({ malId, anilistId }) {
  const mal = Math.floor(Number(malId));
  const ani = Math.floor(Number(anilistId));
  if ((!Number.isFinite(mal) || mal <= 0) && (!Number.isFinite(ani) || ani <= 0)) {
    return null;
  }

  if (Number.isFinite(mal) && mal > 0) {
    const direct = await fetchAnikotoJson(`/series/${mal}`, LOOKUP_CACHE_SEC);
    const directMal = direct?.data?.anime?.mal_id;
    if (directMal != null && String(directMal) === String(mal)) {
      return mal;
    }
  }

  for (let page = 1; page <= MAX_LOOKUP_PAGES; page += 1) {
    const payload = await fetchAnikotoJson(
      `/recent-anime?page=${page}&per_page=${LOOKUP_PER_PAGE}`,
      LOOKUP_CACHE_SEC
    );
    const rows = payload?.data;
    if (!Array.isArray(rows) || rows.length === 0) break;

    for (const row of rows) {
      if (!rowMatchesIds(row, mal, ani)) continue;
      const catalogId = Math.floor(Number(row.id));
      if (Number.isFinite(catalogId) && catalogId > 0) return catalogId;
    }

    if (rows.length < LOOKUP_PER_PAGE) break;
  }

  return null;
}

function pickEmbedUrl(row, audio) {
  const lang = audio === "dub" ? "dub" : "sub";
  const embedId = row?.episode_embed_id;
  if (embedId != null && String(embedId).trim()) {
    return buildMegaPlayCatalogEmbedUrl(embedId, lang);
  }

  const embeds = row?.embed_url;
  if (!embeds || typeof embeds !== "object") return null;

  const direct = embeds[lang];
  if (typeof direct === "string" && direct.startsWith("http")) {
    return normalizeMegaPlayEmbedHost(direct);
  }
  if (typeof embeds.sub === "string" && embeds.sub.startsWith("http")) {
    return normalizeMegaPlayEmbedHost(embeds.sub);
  }
  if (typeof embeds.dub === "string" && embeds.dub.startsWith("http")) {
    return normalizeMegaPlayEmbedHost(embeds.dub);
  }
  return null;
}

/**
 * Fetch episode embed URL from Anikoto catalog + MegaPlay s-2 wrapper.
 * @param {{ malId?: number, anilistId?: number, episode: number, audio: "sub" | "dub" }} params
 * @returns {Promise<string | null>}
 */
export async function resolveAnikotoFallbackEmbedUrl({
  malId,
  anilistId,
  episode,
  audio,
}) {
  const epNum = Math.max(1, Math.floor(Number(episode)) || 1);
  const catalogId = await resolveAnikotoCatalogId({ malId, anilistId });
  if (!catalogId) return null;

  const payload = await fetchAnikotoJson(`/series/${catalogId}`);
  if (!payload) return null;

  const expectedMal = Math.floor(Number(malId));
  const animeMal = payload?.data?.anime?.mal_id;
  if (
    Number.isFinite(expectedMal) &&
    expectedMal > 0 &&
    animeMal != null &&
    String(animeMal) !== String(expectedMal)
  ) {
    return null;
  }

  const episodes = payload?.data?.episodes;
  if (!Array.isArray(episodes)) return null;

  const row = episodes.find((e) => Number(e?.number) === epNum);
  if (!row) return null;

  return sanitizeAnimeEmbedUrl(pickEmbedUrl(row, audio));
}
