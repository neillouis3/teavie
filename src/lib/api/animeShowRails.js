/**
 * Batched anime show rails: related franchise + you-might-like with one Jikan fetch.
 */

import clientPromise from "@/lib/mongo";
import {
  jikanFetchRelationsAndRecommendations,
  jikanFranchiseRailOrderedSteps,
  pickFranchiseRelationCandidates,
  jikanPayloadsToCandidates,
} from "@/lib/jikanFetch";
import {
  runtimeSecondsFromDoc,
  tvEpisodeCountFromDoc,
  tvSeasonCountFromDoc,
} from "@/lib/mapContentDocToItem";
import { animePosterFromDoc } from "@/lib/animePoster.js";

function docAnilistKey(d) {
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

function yearFromDoc(d) {
  const raw = d.release_date ?? d.first_air_date ?? "";
  if (typeof raw !== "string" || raw.length < 4) return "—";
  return raw.slice(0, 4);
}

async function buildRelatedItems(rootMal, relationsJson) {
  const direct = pickFranchiseRelationCandidates(rootMal, relationsJson);
  const chain = await jikanFranchiseRailOrderedSteps(rootMal, {
    rootRelationsJson: relationsJson,
    staggerMs: 350,
    maxNodes: 56,
  });

  const seenMal = new Set([rootMal]);
  const candidates = [];
  for (const s of chain) {
    if (!Number.isFinite(s.malId) || s.malId <= 0 || seenMal.has(s.malId)) continue;
    seenMal.add(s.malId);
    candidates.push(s);
  }
  for (const s of direct) {
    if (!Number.isFinite(s.malId) || s.malId <= 0 || seenMal.has(s.malId)) continue;
    seenMal.add(s.malId);
    candidates.push(s);
  }

  if (candidates.length === 0) return [];

  const malIds = candidates.map((s) => s.malId);
  const malIdsQuery = [...new Set([...malIds, ...malIds.map((n) => String(n))])];
  const client = await clientPromise;
  const docs = await client
    .db("teavie")
    .collection("content")
    .find(
      { type: { $in: ["tv", "movie"] }, mal_id: { $in: malIdsQuery } },
      {
        projection: {
          id: 1,
          type: 1,
          anilist_id: 1,
          anilist: 1,
          mal_id: 1,
          title: 1,
          name: 1,
          poster_path: 1,
          release_date: 1,
          first_air_date: 1,
        },
      }
    )
    .limit(200)
    .toArray();

  const docByMal = new Map();
  for (const d of docs) {
    const m = Number(d.mal_id);
    if (!Number.isFinite(m) || m <= 0 || !malIds.includes(m)) continue;
    if (!docByMal.has(m)) docByMal.set(m, d);
  }

  const items = [];
  for (const step of candidates) {
    const d = docByMal.get(step.malId);
    if (!d) continue;
    items.push({
      catalogId: String(d.id),
      catalogType: d.type === "movie" ? "movie" : "tv",
      anilistId: docAnilistKey(d),
      malId: step.malId,
      malKind: step.malKind,
      title: d.title ?? d.name ?? "Untitled",
      year: yearFromDoc(d),
      posterPath: animePosterFromDoc(d) ?? "",
      topNote: step.topNote,
      externalUrl: null,
    });
  }
  return items;
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
        mal_id: { $in: malIds },
      },
      {
        projection: {
          id: 1,
          anilist_id: 1,
          anilist: 1,
          mal_id: 1,
          title: 1,
          name: 1,
          poster_path: 1,
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
      year: yearFromDoc(doc),
      posterPath: animePosterFromDoc(doc) || c.posterPath,
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
