/**
 * TMDB-ordered catalog discover rails (shared by /api/tmdb/discover and /api/explore).
 */

import clientPromise from "@/lib/mongo";
import { mapContentDocToItem } from "@/lib/mapContentDocToItem";
import { catalogMoviePolicyClause } from "@/lib/catalogQuery";
import { tmdbBearerToken } from "@/lib/tmdbAuth";

const LIMIT = 20;
const SOURCE_PAGES = 3;

function uniquePositiveIds(rows) {
  const ids = (rows || [])
    .map((r) => r.id)
    .filter((id) => typeof id === "number" && id > 0);
  return [...new Set(ids)];
}

async function movieItemsFromTmdbOrder(col, tmdbRows) {
  const ordered = Array.isArray(tmdbRows)
    ? tmdbRows.filter((r) => !r?.adult)
    : [];
  const ids = uniquePositiveIds(ordered);
  if (ids.length === 0) return [];

  const variants = [...ids, ...ids.map(String)];
  const docs = await col
    .find({
      type: "movie",
      id: { $in: variants },
      ...catalogMoviePolicyClause(),
    })
    .toArray();

  const byKey = new Map();
  for (const d of docs) {
    byKey.set(Number(d.id), d);
    byKey.set(String(d.id), d);
  }

  return ordered
    .map((r) => byKey.get(r.id) ?? byKey.get(String(r.id)))
    .filter(Boolean)
    .map(mapContentDocToItem);
}

function buildTvTmdbLookupMap(docs) {
  const map = new Map();
  for (const doc of docs) {
    const keys = new Set();
    const tid = typeof doc.tmdb_id === "number" ? doc.tmdb_id : Number(doc.tmdb_id);
    if (Number.isFinite(tid) && tid > 0) keys.add(tid);
    const ext = doc.external_ids && doc.external_ids.tmdb_id;
    const extn = Number(ext);
    if (Number.isFinite(extn) && extn > 0) keys.add(extn);
    if (!String(doc.id).startsWith("anime_")) {
      const idn = Number(doc.id);
      if (Number.isFinite(idn) && idn > 0) keys.add(idn);
    }

    for (const k of keys) {
      const cur = map.get(k);
      if (!cur) {
        map.set(k, doc);
        continue;
      }
      const curAnime = String(cur.id).startsWith("anime_");
      const nextAnime = String(doc.id).startsWith("anime_");
      if (nextAnime && !curAnime) map.set(k, doc);
    }
  }
  return map;
}

async function tvItemsFromTmdbOrder(col, tmdbRows) {
  const ordered = Array.isArray(tmdbRows)
    ? tmdbRows.filter((r) => !r?.adult)
    : [];
  const ids = uniquePositiveIds(ordered);
  if (ids.length === 0) return [];

  const idVariants = [...ids, ...ids.map(String)];
  const docs = await col
    .find({
      type: "tv",
      $or: [
        { id: { $in: idVariants } },
        { tmdb_id: { $in: ids } },
        { "external_ids.tmdb_id": { $in: ids } },
      ],
    })
    .toArray();

  const byTmdb = buildTvTmdbLookupMap(docs);
  return ordered
    .map((r) => byTmdb.get(Number(r.id)))
    .filter(Boolean)
    .map(mapContentDocToItem);
}

async function fetchTmdbPaged(url, headers) {
  const out = [];
  for (let p = 1; p <= SOURCE_PAGES; p += 1) {
    const u = url.includes("?") ? `${url}&page=${p}` : `${url}?page=${p}`;
    const res = await fetch(u, { headers, next: { revalidate: 3600 } });
    if (!res.ok) break;
    const json = await res.json().catch(() => null);
    const rows = json && typeof json === "object" ? json.results : null;
    if (!Array.isArray(rows) || rows.length === 0) break;
    out.push(...rows);
    if (rows.length < 20) break;
  }
  return out;
}

function capOrdered(items, cap = LIMIT) {
  return (items ?? []).slice(0, cap);
}

export async function loadTmdbDiscoverRails() {
  const empty = {
    trendingMovies: [],
    trendingTv: [],
    popularMovies: [],
    popularTv: [],
  };

  const token = tmdbBearerToken();
  if (!token) {
    return { error: "Missing TMDB bearer token", ...empty };
  }

  const headers = {
    accept: "application/json",
    Authorization: `Bearer ${token}`,
  };

  const [tMovieRows, tTvRows, pMovieRows, pTvRows] = await Promise.all([
    fetchTmdbPaged(
      "https://api.themoviedb.org/3/trending/movie/week?language=en-US&include_adult=false",
      headers
    ),
    fetchTmdbPaged(
      "https://api.themoviedb.org/3/trending/tv/week?language=en-US&include_adult=false",
      headers
    ),
    fetchTmdbPaged(
      "https://api.themoviedb.org/3/movie/popular?language=en-US&include_adult=false",
      headers
    ),
    fetchTmdbPaged(
      "https://api.themoviedb.org/3/tv/popular?language=en-US&include_adult=false",
      headers
    ),
  ]);

  const client = await clientPromise;
  const col = client.db("teavie").collection("content");

  const [trendingMoviesAll, trendingTvAll, popularMoviesAll, popularTvAll] =
    await Promise.all([
      movieItemsFromTmdbOrder(col, tMovieRows),
      tvItemsFromTmdbOrder(col, tTvRows),
      movieItemsFromTmdbOrder(col, pMovieRows),
      tvItemsFromTmdbOrder(col, pTvRows),
    ]);

  return {
    trendingMovies: capOrdered(trendingMoviesAll),
    trendingTv: capOrdered(trendingTvAll),
    popularMovies: capOrdered(popularMoviesAll),
    popularTv: capOrdered(popularTvAll),
  };
}
