import { anilistPost } from "@/lib/anilistFetch";

const QUERY_MEDIA_ID_BY_MAL = `query ($idMal: Int) {
  Media(idMal: $idMal, type: ANIME) { id }
}`;

/**
 * Resolve AniList numeric id for a MAL anime id (one GraphQL round-trip).
 * @param {number} malId
 * @returns {Promise<number | null>}
 */
export async function anilistIdFromMalId(malId) {
  if (!Number.isFinite(malId) || malId <= 0) return null;
  const res = await anilistPost({
    query: QUERY_MEDIA_ID_BY_MAL,
    variables: { idMal: malId },
  });
  if (!res.ok) return null;
  const payload = await res.json().catch(() => null);
  const id = payload?.data?.Media?.id;
  const n = Number(id);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * @param {number[]} malIds
 * @param {Map<number, number | null | undefined>} seed mal → anilist (from Mongo); missing keys are resolved
 * @param {{ concurrency?: number; pauseMs?: number }} opts
 * @returns {Promise<Map<number, number | null>>}
 */
export async function mapMalIdsToAnilistIds(malIds, seed = new Map(), opts = {}) {
  const concurrency = Math.max(1, Math.min(10, opts.concurrency ?? 6));
  const pauseMs = typeof opts.pauseMs === "number" ? opts.pauseMs : 100;
  const unique = [...new Set(malIds.filter((m) => Number.isFinite(m) && m > 0))];
  const out = new Map();
  for (const m of unique) {
    const s = seed.get(m);
    if (typeof s === "number" && Number.isFinite(s) && s > 0) out.set(m, s);
  }
  const missing = unique.filter((m) => !out.has(m));
  for (let i = 0; i < missing.length; i += concurrency) {
    const chunk = missing.slice(i, i + concurrency);
    const pairs = await Promise.all(
      chunk.map(async (mal) => {
        const al = await anilistIdFromMalId(mal);
        return /** @type {const} */ ([mal, al]);
      })
    );
    for (const [mal, al] of pairs) {
      if (al != null) out.set(mal, al);
      else out.set(mal, null);
    }
    if (i + concurrency < missing.length) await sleep(pauseMs);
  }
  return out;
}
