import { anilistPost } from "./anilistFetch.js";

const TITLE_QUERY = `query ($id: Int, $idMal: Int) {
  Media(id: $id, idMal: $idMal, type: ANIME) {
    id
    idMal
    episodes
    format
    title { romaji english native }
    synonyms
  }
}`;

function pickNumeric(raw) {
  if (typeof raw === "number" && Number.isFinite(raw) && raw > 0) return raw;
  if (typeof raw === "string") {
    const n = parseInt(raw, 10);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return null;
}

/**
 * Fetch AniList title aliases + episode count for a catalog anime doc.
 * @param {Record<string, unknown>} doc
 * @returns {Promise<{ anilist: Record<string, unknown>|null, titleCandidates: string[] }>}
 */
export async function fetchAnilistEnrichmentForCatalogDoc(doc) {
  const anilistId = pickNumeric(doc?.anilist_id ?? doc?.anilist?.id ?? doc?.external_ids?.anilist_id);
  const malId = pickNumeric(doc?.mal_id ?? doc?.external_ids?.mal_id);

  if (anilistId == null && malId == null) {
    return { anilist: null, titleCandidates: [] };
  }

  const variables =
    anilistId != null ? { id: anilistId, idMal: null } : { id: null, idMal: malId };

  try {
    const res = await anilistPost({ query: TITLE_QUERY, variables });
    if (!res.ok) return { anilist: null, titleCandidates: [] };

    const payload = await res.json();
    const m = payload?.data?.Media;
    if (!m) return { anilist: null, titleCandidates: [] };

    const titleCandidates = [];
    const push = (s) => {
      const t = typeof s === "string" ? s.trim() : "";
      if (t && !titleCandidates.includes(t)) titleCandidates.push(t);
    };
    push(m.title?.english);
    push(m.title?.romaji);
    push(m.title?.native);
    if (Array.isArray(m.synonyms)) {
      for (const s of m.synonyms) push(s);
    }

    const anilist = {
      id: m.id ?? null,
      episodes: Number.isFinite(Number(m.episodes)) ? Number(m.episodes) : null,
      format: m.format ?? null,
      title: {
        romaji: m.title?.romaji ?? null,
        english: m.title?.english ?? null,
        native: m.title?.native ?? null,
      },
    };

    return { anilist, titleCandidates };
  } catch {
    return { anilist: null, titleCandidates: [] };
  }
}
