/**
 * Batched anime show rails: related franchise + you-might-like with one Jikan fetch.
 */

import clientPromise from "@/lib/mongo";
import {
  jikanFetchRelationsAndRecommendations,
  jikanFranchiseRailOrderedSteps,
  jikanGet,
  pickFranchiseRelationCandidates,
  jikanPayloadsToCandidates,
} from "@/lib/jikanFetch";
import {
  runtimeSecondsFromDoc,
  tvEpisodeCountFromDoc,
  tvSeasonCountFromDoc,
} from "@/lib/mapContentDocToItem";
import { animePosterFromDoc, animeBackdropFromDoc } from "@/lib/animePoster.js";
import {
  buildAnimeRelatedCatalogItems,
  docAnilistKey,
  normalizeRelatedMalId,
  yearFromCatalogDoc,
} from "@/lib/animeRelatedCatalog.js";

async function buildRelatedItems(rootMal, relationsJson) {
  const direct = pickFranchiseRelationCandidates(rootMal, relationsJson);
  const chain = await jikanFranchiseRailOrderedSteps(rootMal, {
    rootRelationsJson: relationsJson,
    staggerMs: 350,
    maxNodes: 56,
  });

  const seenMal = new Set([normalizeRelatedMalId(rootMal)]);
  /** @type {Array<{ malId: number; malKind?: string; topNote: string }>} */
  const candidates = [];
  for (const s of chain) {
    const mal = normalizeRelatedMalId(s.malId);
    if (!Number.isFinite(mal) || mal <= 0 || seenMal.has(mal)) continue;
    seenMal.add(mal);
    candidates.push(s);
  }
  for (const s of direct) {
    const mal = normalizeRelatedMalId(s.malId);
    if (!Number.isFinite(mal) || mal <= 0 || seenMal.has(mal)) continue;
    seenMal.add(mal);
    candidates.push(s);
  }

  return buildAnimeRelatedCatalogItems(candidates);
}

async function buildYouMightLikeItems(rootMal, recsJson, limit) {
  const candidates = jikanPayloadsToCandidates(rootMal, null, recsJson).slice(0, limit);
  if (candidates.length === 0) return [];

  const malIds = candidates.map((c) => c.malId);
  const client = await clientPromise;
  const docs = await client
    .db("teavie")
    .collection("content")
    .find(
      {
        type: "tv",
        id: { $regex: "^anime_" },
        mal_id: { $in: [...malIds, ...malIds.map(String)] },
      },
      {
        projection: {
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
          first_air_date: 1,
          release_date: 1,
          runtimeSeconds: 1,
          runtime: 1,
          season_amount: 1,
          number_of_seasons: 1,
          number_of_episodes: 1,
        },
      }
    )
    .limit(limit)
    .toArray();

  const byMal = new Map();
  for (const d of docs) {
    const cid = String(d.id);
    if (!cid.startsWith("anime_")) continue;
    const m = typeof d.mal_id === "number" ? d.mal_id : null;
    if (m == null || !malIds.includes(m)) continue;
    if (!byMal.has(m)) byMal.set(m, { catalogId: cid, doc: d });
  }

  const items = [];
  for (const c of candidates) {
    const row = byMal.get(c.malId);
    if (!row) continue;
    const doc = row.doc;
    items.push({
      catalogId: row.catalogId,
      malId: c.malId,
      anilistId: docAnilistKey(doc),
      title: doc.title ?? doc.name ?? c.title,
      year: yearFromCatalogDoc(doc),
      posterPath: animePosterFromDoc(doc) || c.posterPath,
      backdropPath: animeBackdropFromDoc(doc) ?? "",
      runtimeSeconds: runtimeSecondsFromDoc(doc),
      seasonAmount: tvSeasonCountFromDoc(doc) ?? 0,
      numberOfEpisodes: tvEpisodeCountFromDoc(doc),
    });
    if (items.length >= limit) break;
  }
  return items;
}

export async function loadAnimeShowRails(idMal, ymlLimit = 14) {
  const rootMal = Math.floor(Number(idMal));
  if (!Number.isFinite(rootMal) || rootMal <= 0) {
    return { related: [], youMightLike: [] };
  }

  const jk = await jikanFetchRelationsAndRecommendations(rootMal, {
    includeRelations: true,
    includeRecommendations: true,
    staggerMs: 350,
  });

  const [related, youMightLike] = await Promise.all([
    buildRelatedItems(rootMal, jk.relationsJson),
    buildYouMightLikeItems(rootMal, jk.recsJson, ymlLimit),
  ]);

  return { related, youMightLike };
}

export async function loadAnimeRelatedItems(idMal) {
  const rootMal = Math.floor(Number(idMal));
  if (!Number.isFinite(rootMal) || rootMal <= 0) return [];

  const relRes = await jikanGet(`anime/${rootMal}/relations`);
  const relationsJson = relRes.ok ? await relRes.json().catch(() => null) : null;
  return buildRelatedItems(rootMal, relationsJson);
}
