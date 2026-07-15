/**
 * Prefer TMDB widescreen backdrops for anime catalog rows when a TMDB id is known.
 * Falls back to AniList banner / stored art via animeBackdropFromDoc.
 */

import { isAnimeCatalogDoc, isTmdbImagePath } from "@/lib/animePoster";
import { tmdbAuth, tmdbFetchJson } from "@/lib/tmdbAuth";

/** @type {Map<number, { backdrop: string | null; poster: string | null; at: number }>} */
const TMDB_ART_CACHE = new Map();
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

/**
 * @param {unknown} doc
 * @returns {number | null}
 */
export function catalogAnimeTmdbId(doc) {
  if (!doc || typeof doc !== "object") return null;
  const d = /** @type {Record<string, unknown>} */ (doc);
  const direct = Number(d.tmdb_id);
  if (Number.isFinite(direct) && direct > 0) return direct;
  const ext = d.external_ids;
  if (ext && typeof ext === "object") {
    const n = Number(/** @type {Record<string, unknown>} */ (ext).tmdb_id);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return null;
}

/**
 * @param {number} tmdbId
 * @returns {Promise<{ backdrop: string | null; poster: string | null } | null>}
 */
async function fetchTmdbTvArt(tmdbId) {
  const cached = TMDB_ART_CACHE.get(tmdbId);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return { backdrop: cached.backdrop, poster: cached.poster };
  }

  const auth = tmdbAuth();
  if (!auth) return null;

  try {
    const data = await tmdbFetchJson(
      `https://api.themoviedb.org/3/tv/${tmdbId}?language=en-US`,
      auth,
      { timeoutMs: 8000 }
    );
    const backdrop =
      typeof data?.backdrop_path === "string" && data.backdrop_path.trim()
        ? data.backdrop_path.trim()
        : null;
    const poster =
      typeof data?.poster_path === "string" && data.poster_path.trim()
        ? data.poster_path.trim()
        : null;
    TMDB_ART_CACHE.set(tmdbId, { backdrop, poster, at: Date.now() });
    return { backdrop, poster };
  } catch {
    return null;
  }
}

/**
 * Mutates anime docs in place: sets `backdrop_path` from TMDB when available.
 * @param {unknown[]} docs
 * @returns {Promise<unknown[]>}
 */
export async function enrichAnimeDocsWithTmdbBackdrops(docs) {
  if (!Array.isArray(docs) || docs.length === 0) return docs;
  if (!tmdbAuth()) return docs;

  /** @type {Map<number, object[]>} */
  const byId = new Map();

  for (const doc of docs) {
    if (!isAnimeCatalogDoc(doc)) continue;
    if (isTmdbImagePath(/** @type {object} */ (doc).backdrop_path)) continue;
    const tmdbId = catalogAnimeTmdbId(doc);
    if (tmdbId == null) continue;
    const list = byId.get(tmdbId) ?? [];
    list.push(/** @type {object} */ (doc));
    byId.set(tmdbId, list);
  }

  if (byId.size === 0) return docs;

  const ids = [...byId.keys()];
  const concurrency = 6;
  for (let i = 0; i < ids.length; i += concurrency) {
    const chunk = ids.slice(i, i + concurrency);
    await Promise.all(
      chunk.map(async (tmdbId) => {
        const art = await fetchTmdbTvArt(tmdbId);
        if (!art?.backdrop) return;
        for (const doc of byId.get(tmdbId) ?? []) {
          doc.backdrop_path = art.backdrop;
        }
      })
    );
  }

  return docs;
}
