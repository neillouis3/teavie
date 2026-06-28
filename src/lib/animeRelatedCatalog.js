/**
 * Map related-anime franchise rows to Teavie catalog metadata (poster, backdrop, counts).
 */

import clientPromise from "./mongo.js";
import { animeBackdropFromDoc, animePosterFromDoc } from "./animePoster.js";
import {
  mergedSplitCourEpisodeCount,
  primaryMalForSplitCourMal,
  splitCourGroupForMal,
} from "./animeSplitCour.js";
import {
  tvEpisodeCountFromDoc,
  tvSeasonCountFromDoc,
} from "./mapContentDocToItem.js";

export const ANIME_RELATED_CATALOG_PROJECTION = {
  id: 1,
  type: 1,
  is_anime: 1,
  tags: 1,
  anilist_id: 1,
  anilist: 1,
  mal_id: 1,
  title: 1,
  name: 1,
  poster_path: 1,
  backdrop_path: 1,
  release_date: 1,
  first_air_date: 1,
  number_of_episodes: 1,
  number_of_seasons: 1,
  season_amount: 1,
  vote_average: 1,
};

export function docAnilistKey(d) {
  const a = d?.anilist_id;
  if (typeof a === "number" && Number.isFinite(a) && a > 0) return a;
  if (typeof a === "string") {
    const n = parseInt(a, 10);
    if (Number.isFinite(n) && n > 0) return n;
  }
  const b = d?.anilist?.id;
  if (typeof b === "number" && Number.isFinite(b) && b > 0) return b;
  if (typeof b === "string") {
    const n = parseInt(b, 10);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return null;
}

export function yearFromCatalogDoc(d) {
  const raw = d?.release_date ?? d?.first_air_date ?? "";
  if (typeof raw !== "string" || raw.length < 4) return "—";
  return raw.slice(0, 4);
}

/** Collapse split-cour part rows to their primary MAL id for related rails. */
export function normalizeRelatedMalId(malId) {
  return primaryMalForSplitCourMal(malId) ?? Math.floor(Number(malId));
}

/**
 * Dedupe franchise steps; map hidden split-cour parts to primary catalog rows.
 * @param {Array<{ malId: number; malKind?: string; topNote: string }>} candidates
 */
export function normalizeRelatedCandidates(candidates) {
  const seen = new Set();
  /** @type {Array<{ malId: number; malKind?: string; topNote: string }>} */
  const out = [];
  for (const step of candidates) {
    const mal = normalizeRelatedMalId(step.malId);
    if (!Number.isFinite(mal) || mal <= 0 || seen.has(mal)) continue;
    seen.add(mal);
    out.push({ ...step, malId: mal });
  }
  return out;
}

/**
 * @param {number[]} malIds
 */
export async function fetchCatalogDocsByMalIds(malIds) {
  const ids = [...new Set(malIds.map((m) => Math.floor(Number(m)))).filter((m) => m > 0)];
  if (!ids.length) return new Map();

  const idKeys = ids.flatMap((m) => [m, String(m), `anime_${m}`]);
  const client = await clientPromise;
  const docs = await client
    .db("teavie")
    .collection("content")
    .find(
      {
        type: { $in: ["tv", "movie"] },
        $or: [{ mal_id: { $in: idKeys } }, { id: { $in: idKeys } }],
      },
      { projection: ANIME_RELATED_CATALOG_PROJECTION }
    )
    .limit(200)
    .toArray();

  /** @type {Map<number, (typeof docs)[number]>} */
  const byMal = new Map();
  for (const doc of docs) {
    const mal = normalizeRelatedMalId(doc.mal_id ?? String(doc.id).replace(/^anime_/i, ""));
    if (!ids.includes(mal)) continue;
    if (!byMal.has(mal)) byMal.set(mal, doc);
  }
  return byMal;
}

function episodeCountForRelatedDoc(doc) {
  const mal = normalizeRelatedMalId(
    doc.mal_id ?? String(doc.id ?? "").replace(/^anime_/i, "")
  );
  const group = splitCourGroupForMal(mal);
  if (group && group.primaryMalId === mal) {
    return mergedSplitCourEpisodeCount(group);
  }
  return tvEpisodeCountFromDoc(doc);
}

/**
 * @param {{ malId: number; malKind?: string; topNote: string }} step
 * @param {Record<string, unknown>} doc
 */
export function mapAnimeRelatedCatalogItem(step, doc) {
  const catalogId = String(doc.id);
  const catalogType = doc.type === "movie" ? "movie" : "tv";
  const episodes = episodeCountForRelatedDoc(doc);
  return {
    catalogId,
    catalogType,
    anilistId: docAnilistKey(doc),
    malId: step.malId,
    malKind: step.malKind ?? (catalogType === "movie" ? "movie" : "anime"),
    title: doc.title ?? doc.name ?? "Untitled",
    year: yearFromCatalogDoc(doc),
    posterPath: animePosterFromDoc(doc) ?? "",
    backdropPath: animeBackdropFromDoc(doc) ?? "",
    seasonAmount: tvSeasonCountFromDoc(doc) ?? (String(catalogId).startsWith("anime_") ? 1 : 0),
    numberOfEpisodes: episodes,
    topNote: step.topNote,
    externalUrl: null,
  };
}

/**
 * @param {Array<{ malId: number; malKind?: string; topNote: string }>} candidates
 */
export async function buildAnimeRelatedCatalogItems(candidates) {
  const normalized = normalizeRelatedCandidates(candidates);
  if (!normalized.length) return [];

  const docByMal = await fetchCatalogDocsByMalIds(normalized.map((s) => s.malId));
  /** @type {ReturnType<typeof mapAnimeRelatedCatalogItem>[]} */
  const items = [];
  for (const step of normalized) {
    const doc = docByMal.get(step.malId);
    if (!doc) continue;
    try {
      items.push(mapAnimeRelatedCatalogItem(step, doc));
    } catch (err) {
      console.error("[anime related map]", step.malId, err);
    }
  }
  return items;
}
