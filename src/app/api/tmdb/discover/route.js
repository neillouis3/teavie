/**
 * Discover rails: TMDB defines order (trending/popular); tiles come from `teavie.content`.
 * TV rows resolve by numeric `id` or by `tmdb_id` / `external_ids.tmdb_id` so anime stays `anime_*`.
 */

import clientPromise from "@/lib/mongo";
import { mapContentDocToItem } from "@/lib/mapContentDocToItem";

const LIMIT = 12;

function uniquePositiveIds(rows) {
  const ids = (rows || [])
    .map((r) => r.id)
    .filter((id) => typeof id === "number" && id > 0);
  return [...new Set(ids)];
}

async function movieItemsFromTmdbOrder(col, tmdbRows) {
  const slice = (tmdbRows || []).slice(0, LIMIT);
  const ids = uniquePositiveIds(slice);
  if (ids.length === 0) return [];

  const variants = [...ids, ...ids.map(String)];
  const docs = await col
    .find({ type: "movie", id: { $in: variants } })
    .toArray();

  const byKey = new Map();
  for (const d of docs) {
    byKey.set(Number(d.id), d);
    byKey.set(String(d.id), d);
  }

  return slice
    .map((r) => byKey.get(r.id) ?? byKey.get(String(r.id)))
    .filter(Boolean)
    .map(mapContentDocToItem);
}

/**
 * Map TMDB TV id -> catalog doc. Prefer `anime_*` when two docs claim the same TMDB id.
 */
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
  const slice = (tmdbRows || []).slice(0, LIMIT);
  const ids = uniquePositiveIds(slice);
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
  return slice
    .map((r) => byTmdb.get(Number(r.id)))
    .filter(Boolean)
    .map(mapContentDocToItem);
}

export async function GET() {
  const empty = {
    trendingMovies: [],
    trendingTv: [],
    popularMovies: [],
    popularTv: [],
  };

  try {
    const token =
      process.env.NEXT_PUBLIC_TMDB_BEARER || process.env.TMDB_BEARER;
    if (!token) {
      return Response.json(
        {
          error: "Missing TMDB bearer token",
          ...empty,
        },
        { status: 500 }
      );
    }

    const headers = {
      accept: "application/json",
      Authorization: `Bearer ${token}`,
    };

    const [tMovieRes, tTvRes, pMovieRes, pTvRes] = await Promise.all([
      fetch(
        "https://api.themoviedb.org/3/trending/movie/week?language=en-US",
        { headers, next: { revalidate: 3600 } }
      ),
      fetch(
        "https://api.themoviedb.org/3/trending/tv/week?language=en-US",
        { headers, next: { revalidate: 3600 } }
      ),
      fetch(
        "https://api.themoviedb.org/3/movie/popular?language=en-US&page=1",
        { headers, next: { revalidate: 3600 } }
      ),
      fetch("https://api.themoviedb.org/3/tv/popular?language=en-US&page=1", {
        headers,
        next: { revalidate: 3600 },
      }),
    ]);

    if (!tMovieRes.ok || !tTvRes.ok || !pMovieRes.ok || !pTvRes.ok) {
      return Response.json(
        { error: "One or more TMDB discover requests failed", ...empty },
        { status: 502 }
      );
    }

    const [tMovieJson, tTvJson, pMovieJson, pTvJson] = await Promise.all([
      tMovieRes.json(),
      tTvRes.json(),
      pMovieRes.json(),
      pTvRes.json(),
    ]);

    const client = await clientPromise;
    const col = client.db("teavie").collection("content");

    const [trendingMovies, trendingTv, popularMovies, popularTv] =
      await Promise.all([
        movieItemsFromTmdbOrder(col, tMovieJson.results || []),
        tvItemsFromTmdbOrder(col, tTvJson.results || []),
        movieItemsFromTmdbOrder(col, pMovieJson.results || []),
        tvItemsFromTmdbOrder(col, pTvJson.results || []),
      ]);

    return Response.json({
      trendingMovies,
      trendingTv,
      popularMovies,
      popularTv,
    });
  } catch (err) {
    console.error(err);
    return Response.json(
      {
        error: "discover failed",
        ...empty,
      },
      { status: 500 }
    );
  }
}
