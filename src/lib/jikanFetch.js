/**
 * Jikan v4 (api.jikan.moe) — same base as `scripts/import-anime-to-tv.js`.
 * Set `JIKAN_BASE` to override (e.g. self-hosted).
 */
const JIKAN_BASE =
  (typeof process !== "undefined" && process.env.JIKAN_BASE?.trim()?.replace(/\/$/, "")) ||
  "https://api.jikan.moe/v4";

const USER_AGENT =
  (typeof process !== "undefined" && process.env.JIKAN_UA?.trim()) ||
  "Teavie/1.0 (+https://github.com/neillouis3/teavie; catalog API)";

/**
 * @param {string} path e.g. `anime/21/relations` (no leading slash)
 */
export async function jikanGet(path) {
  const url = `${JIKAN_BASE}/${path.replace(/^\//, "")}`;
  return fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/json",
      "User-Agent": USER_AGENT,
    },
  });
}

export function jikanPosterFromEntry(entry) {
  const jpg = entry?.images?.jpg;
  const large =
    typeof jpg?.large_image_url === "string" ? jpg.large_image_url.trim() : "";
  const def =
    typeof jpg?.image_url === "string" ? jpg.image_url.trim() : "";
  return large || def || "";
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * @param {number} rootMal
 * @param {{ includeRelations?: boolean; includeRecommendations?: boolean; staggerMs?: number }} opts
 */
export async function jikanFetchRelationsAndRecommendations(rootMal, opts = {}) {
  const includeRelations = opts.includeRelations !== false;
  const includeRecommendations = opts.includeRecommendations !== false;
  const staggerMs = typeof opts.staggerMs === "number" ? opts.staggerMs : 400;

  let relationsStatus = 0;
  /** @type {unknown} */
  let relationsJson = null;
  if (includeRelations) {
    const relationsRes = await jikanGet(`anime/${rootMal}/relations`);
    relationsStatus = relationsRes.status;
    relationsJson = relationsRes.ok ? await relationsRes.json().catch(() => null) : null;
    if (includeRecommendations) await sleep(staggerMs);
  }

  let recsStatus = 0;
  /** @type {unknown} */
  let recsJson = null;
  if (includeRecommendations) {
    const recsRes = await jikanGet(`anime/${rootMal}/recommendations`);
    recsStatus = recsRes.status;
    recsJson = recsRes.ok ? await recsRes.json().catch(() => null) : null;
  }

  return {
    relationsJson,
    recsJson,
    relationsStatus,
    recsStatus,
  };
}

/** Jikan / MAL relation labels for same-franchise chain (not adaptations, summaries, etc.). */
const FRANCHISE_RELATION_LABELS = new Set([
  "sequel",
  "prequel",
  "parent story",
  "parent",
]);

/**
 * @param {string} relation raw label from Jikan
 */
export function isFranchiseRelationLabel(relation) {
  const r = String(relation || "")
    .trim()
    .toLowerCase();
  return FRANCHISE_RELATION_LABELS.has(r);
}

/**
 * Jikan relations (+ optional recommendations) → unique anime rows (MAL id, note, title, poster).
 * @param {number} rootMal
 * @param {unknown} relationsPayload
 * @param {unknown} recsPayload
 * @param {{ franchiseOnly?: boolean; includeRecommendations?: boolean }} [opts]
 */
export function jikanPayloadsToCandidates(rootMal, relationsPayload, recsPayload, opts = {}) {
  const franchiseOnly = opts.franchiseOnly === true;
  const includeRecommendations =
    opts.includeRecommendations !== false && !franchiseOnly;

  const seen = new Set([rootMal]);
  /** @type {Array<{ malId: number; topNote: string; title: string; year: string; posterPath: string }>} */
  const out = [];

  const dataRel =
    relationsPayload && typeof relationsPayload === "object" && "data" in relationsPayload
      ? /** @type {{ data?: unknown[] }} */ (relationsPayload).data
      : null;
  if (Array.isArray(dataRel)) {
    for (const block of dataRel) {
      const relation =
        typeof block?.relation === "string" && block.relation.trim()
          ? block.relation.trim()
          : "Related";
      if (franchiseOnly && !isFranchiseRelationLabel(relation)) continue;
      const entries = Array.isArray(block?.entry) ? block.entry : [];
      for (const entry of entries) {
        if (String(entry?.type || "").toLowerCase() !== "anime") continue;
        const malId = Number(entry?.mal_id);
        if (!Number.isFinite(malId) || malId <= 0 || seen.has(malId)) continue;
        seen.add(malId);
        const title =
          typeof entry?.name === "string" && entry.name.trim()
            ? entry.name.trim()
            : `MAL ${malId}`;
        out.push({
          malId,
          topNote: relation,
          title,
          year: "—",
          posterPath: jikanPosterFromEntry(entry),
        });
      }
    }
  }

  if (!includeRecommendations) return out;

  const dataRec =
    recsPayload && typeof recsPayload === "object" && "data" in recsPayload
      ? /** @type {{ data?: unknown[] }} */ (recsPayload).data
      : null;
  if (Array.isArray(dataRec)) {
    for (const row of dataRec) {
      const entry = row?.entry;
      const malId = Number(entry?.mal_id);
      if (!Number.isFinite(malId) || malId <= 0 || seen.has(malId)) continue;
      seen.add(malId);
      const title =
        typeof entry?.title === "string" && entry.title.trim()
          ? entry.title.trim()
          : typeof entry?.name === "string" && entry.name.trim()
            ? entry.name.trim()
            : `MAL ${malId}`;
      out.push({
        malId,
        topNote: "Similar",
        title,
        year: "—",
        posterPath: jikanPosterFromEntry(entry),
      });
    }
  }

  return out;
}

export { JIKAN_BASE };
