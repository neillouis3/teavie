/**
 * Batched anime show rails: related franchise + you-might-like with one Jikan fetch.
 */

import clientPromise from "@/lib/mongo";
import {
  jikanFetchRelationsAndRecommendations,
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
  malIdFromCatalogDoc,
  malIdsMongoIn,
  normalizeRelatedMalId,
  yearFromCatalogDoc,
} from "@/lib/animeRelatedCatalog.js";

async function buildRelatedItems(rootMal, relationsJson) {
  let relJson = relationsJson;
  if (!relJson) {
    try {
      const res = await jikanGet(`anime/${rootMal}/relations`);
      if (res.ok) relJson = await res.json().catch(() => null);
    } catch (err) {
      console.error("[anime related jikan]", err);
    }
  }

  const direct = pickFranchiseRelationCandidates(rootMal, relJson);
  const rootNorm = normalizeRelatedMalId(rootMal);
  const seenMal = new Set([rootNorm]);
  /** @type {Array<{ malId: number; malKind?: string; topNote: string }>} */
  const candidates = [];

  for (const step of direct) {
    const mal = normalizeRelatedMalId(step.malId);
    if (!Number.isFinite(mal) || mal <= 0 || mal === rootNorm || seenMal.has(mal)) continue;
    seenMal.add(mal);
    candidates.push({ ...step, malId: mal });
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
        mal_id: { $in: malIdsMongoIn(malIds) },
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
    const m = malIdFromCatalogDoc(d);
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

  let relationsJson = null;
  let recsJson = null;
  try {
    const jk = await jikanFetchRelationsAndRecommendations(rootMal, {
      includeRelations: true,
      includeRecommendations: true,
      staggerMs: 200,
    });
    relationsJson = jk.relationsJson;
    recsJson = jk.recsJson;
  } catch (err) {
    console.error("[anime show rails jikan fetch]", err);
  }

  const [relatedResult, ymlResult] = await Promise.allSettled([
    buildRelatedItems(rootMal, relationsJson),
    buildYouMightLikeItems(rootMal, recsJson, ymlLimit),
  ]);

  const related =
    relatedResult.status === "fulfilled" ? relatedResult.value : [];
  const youMightLike =
    ymlResult.status === "fulfilled" ? ymlResult.value : [];

  if (relatedResult.status === "rejected") {
    console.error("[anime show rails related]", relatedResult.reason);
  }
  if (ymlResult.status === "rejected") {
    console.error("[anime show rails yml]", ymlResult.reason);
  }

  return { related, youMightLike };
}

export async function loadAnimeRelatedItems(idMal) {
  const rootMal = Math.floor(Number(idMal));
  if (!Number.isFinite(rootMal) || rootMal <= 0) return [];

  let relationsJson = null;
  try {
    const jk = await jikanFetchRelationsAndRecommendations(rootMal, {
      includeRelations: true,
      includeRecommendations: false,
      staggerMs: 200,
    });
    relationsJson = jk.relationsJson;
  } catch (err) {
    console.error("[anime related jikan fetch]", err);
  }

  return buildRelatedItems(rootMal, relationsJson).catch((err) => {
    console.error("[anime related items]", err);
    return [];
  });
}
