/**
 * TMDB-based "You might like" rows for movie / TV watch pages.
 */

import clientPromise from "@/lib/mongo";
import {
  runtimeSecondsFromDoc,
  tvEpisodeCountFromDoc,
  tvSeasonCountFromDoc,
} from "@/lib/mapContentDocToItem";
import { passesPopularQualityGate } from "@/lib/catalogPopularity";
import { isBlockedMovieTmdbId } from "@/lib/tmdbMovieContentPolicy";
import { tmdbFetchJson } from "@/lib/tmdbAuth";

const DEFAULT_LIMIT = 8;
const MAX_LIMIT = 24;

function yearFromDate(date) {
  if (!date) return "—";
  const year = new Date(String(date)).getFullYear();
  return Number.isFinite(year) ? String(year) : "—";
}

function takeResults(json) {
  return Array.isArray(json?.results) ? json.results : [];
}

function shouldSkipRow(mediaType, tmdbId, row, { popularFallback = false } = {}) {
  if (!Number.isFinite(tmdbId) || tmdbId <= 0) return true;
  if (mediaType === "movie" && isBlockedMovieTmdbId(String(tmdbId))) return true;
  if (popularFallback && !passesPopularQualityGate(row)) return true;
  return false;
}

async function enrichWithCatalogMeta(items, mediaType) {
  if (items.length === 0) return items;

  const ids = items.map((item) => item.linkId);
  const numeric = ids
    .map((id) => Number(id))
    .filter((n) => Number.isFinite(n) && n > 0);

  const or = [{ id: { $in: ids } }];
  if (numeric.length > 0) {
    or.push({ id: { $in: numeric } }, { tmdb_id: { $in: numeric } });
  }

  const client = await clientPromise;
  const docs = await client
    .db("teavie")
    .collection("content")
    .find(
      { type: mediaType, $or: or },
      {
        projection: {
          id: 1,
          tmdb_id: 1,
          runtimeSeconds: 1,
          runtime: 1,
          season_amount: 1,
          number_of_seasons: 1,
          number_of_episodes: 1,
          anilist: 1,
        },
      }
    )
    .toArray();

  const metaByKey = new Map();
  for (const doc of docs) {
    const payload = {
      runtimeSeconds: runtimeSecondsFromDoc(doc),
      seasonAmount: tvSeasonCountFromDoc(doc) ?? 0,
      numberOfEpisodes: tvEpisodeCountFromDoc(doc),
    };
    metaByKey.set(String(doc.id), payload);
    if (typeof doc.tmdb_id === "number" && doc.tmdb_id > 0) {
      metaByKey.set(String(doc.tmdb_id), payload);
    }
  }

  return items.map((item) => {
    const meta = metaByKey.get(item.linkId);
    if (!meta) return item;
    return { ...item, ...meta };
  });
}

/**
 * @param {"movie" | "tv"} mediaType
 * @param {string | number} id TMDB id
 * @param {number} [limit]
 */
export async function loadTmdbYouMightLike(mediaType, id, limit = DEFAULT_LIMIT) {
  if (mediaType !== "movie" && mediaType !== "tv") return [];
  const idStr = String(id ?? "").trim();
  if (!/^\d+$/.test(idStr)) return [];

  const cap = Math.min(MAX_LIMIT, Math.max(1, limit));
  const sourceId = Number(idStr);

  const [recJson, simJson, popJson] = await Promise.all([
    tmdbFetchJson(
      `https://api.themoviedb.org/3/${mediaType}/${idStr}/recommendations?language=en-US&page=1`
    ).catch(() => ({ results: [] })),
    tmdbFetchJson(
      `https://api.themoviedb.org/3/${mediaType}/${idStr}/similar?language=en-US&page=1`
    ).catch(() => ({ results: [] })),
    tmdbFetchJson(
      `https://api.themoviedb.org/3/${mediaType}/popular?language=en-US&page=1`
    ).catch(() => ({ results: [] })),
  ]);

  const out = [];
  const seen = new Set();

  const merge = (rows, { popularFallback = false } = {}) => {
    for (const row of rows) {
      const tmdbId = Number(row?.id);
      if (tmdbId === sourceId || seen.has(tmdbId)) continue;
      if (shouldSkipRow(mediaType, tmdbId, row, { popularFallback })) continue;
      seen.add(tmdbId);
      out.push({
        keyId: tmdbId,
        linkId: String(tmdbId),
        title: row.title ?? row.name ?? "Untitled",
        poster_path: row.poster_path ?? null,
        backdrop_path: row.backdrop_path ?? null,
        year: yearFromDate(row.release_date ?? row.first_air_date),
        voteAverage:
          typeof row.vote_average === "number" ? row.vote_average : null,
      });
      if (out.length >= cap) break;
    }
  };

  merge(takeResults(recJson));
  if (out.length < cap) merge(takeResults(simJson));
  if (out.length < cap) merge(takeResults(popJson), { popularFallback: true });

  return enrichWithCatalogMeta(out, mediaType);
}
