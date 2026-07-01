/**
 * Batch catalog lookup for watch history cards.
 * POST { entries: [{ catalogId, mediaType }] }
 */
import clientPromise from "@/lib/mongo";
import { mapContentDocToItem } from "@/lib/mapContentDocToItem";
import { isBlockedMovieTmdbId } from "@/lib/tmdbMovieContentPolicy";
import { tmdbFetchJson } from "@/lib/tmdbAuth";

function mapTmdbToItem(entry, data) {
  if (entry.mediaType === "movie") {
    return {
      id: entry.catalogId,
      type: "movie",
      title: data.title ?? "Unknown",
      release_date: data.release_date ?? null,
      poster_path: data.poster_path ?? "",
      backdrop_path: data.backdrop_path ?? "",
    };
  }
  return {
    id: entry.catalogId,
    type: "tv",
    name: data.name ?? "Unknown",
    title: data.name ?? "Unknown",
    first_air_date: data.first_air_date ?? null,
    poster_path: data.poster_path ?? "",
    backdrop_path: data.backdrop_path ?? "",
    season_amount: data.number_of_seasons ?? 0,
    number_of_episodes: data.number_of_episodes ?? undefined,
  };
}

async function resolveEntryItem(entry, byKey, reqSignal) {
  if (reqSignal?.aborted) return null;
  const item = byKey.get(entry.catalogId);
  if (item) {
    if (entry.mediaType === "movie" && item.type !== "movie") return null;
    if (entry.mediaType === "tv" && item.type !== "tv") return null;
    if (entry.mediaType === "movie" && isBlockedMovieTmdbId(entry.catalogId)) {
      return null;
    }
    return { ...item, id: entry.catalogId };
  }

  if (!/^\d+$/.test(entry.catalogId)) return null;
  if (entry.mediaType === "movie" && isBlockedMovieTmdbId(entry.catalogId)) {
    return null;
  }

  try {
    const path =
      entry.mediaType === "movie"
        ? `movie/${entry.catalogId}`
        : `tv/${entry.catalogId}`;
    const data = await tmdbFetchJson(
      `https://api.themoviedb.org/3/${path}?language=en-US`,
      undefined,
      { signal: reqSignal }
    );
    return mapTmdbToItem(entry, data);
  } catch {
    return null;
  }
}

function parseEntries(body) {
  const list = body?.entries;
  if (!Array.isArray(list)) return [];
  const out = [];
  const seen = new Set();
  for (const row of list) {
    const catalogId = String(row?.catalogId ?? "").trim();
    if (!catalogId || seen.has(catalogId)) continue;
    seen.add(catalogId);
    const mediaType = row?.mediaType === "movie" ? "movie" : "tv";
    out.push({ catalogId, mediaType });
    if (out.length >= 24) break;
  }
  return out;
}

function isAbortError(err) {
  return (
    err?.name === "AbortError" ||
    err?.code === "ABORT_ERR" ||
    err?.message === "aborted"
  );
}

export async function POST(req) {
  try {
    if (req.signal?.aborted) {
      return Response.json({ items: [] });
    }
    const body = await req.json();
    const entries = parseEntries(body);
    if (entries.length === 0) {
      return Response.json({ items: [] });
    }

    const ids = entries.map((e) => e.catalogId);
    const numeric = ids
      .map((id) => Number(id))
      .filter((n) => Number.isFinite(n) && n > 0);

    const or = [{ id: { $in: ids } }];
    if (numeric.length) {
      or.push({ id: { $in: numeric } }, { tmdb_id: { $in: numeric } });
    }

    const client = await clientPromise;
    const docs = await client
      .db("teavie")
      .collection("content")
      .find(
        { $or: or },
        {
          projection: {
            id: 1,
            tmdb_id: 1,
            type: 1,
            title: 1,
            name: 1,
            release_date: 1,
            first_air_date: 1,
            poster_path: 1,
            backdrop_path: 1,
            runtimeSeconds: 1,
            runtime: 1,
            season_amount: 1,
            number_of_seasons: 1,
            number_of_episodes: 1,
          },
        }
      )
      .toArray();

    /** @type {Map<string, ReturnType<typeof mapContentDocToItem>>} */
    const byKey = new Map();
    for (const doc of docs) {
      const item = mapContentDocToItem(doc);
      const keys = new Set([String(doc.id)]);
      if (typeof doc.tmdb_id === "number" && doc.tmdb_id > 0) {
        keys.add(String(doc.tmdb_id));
      }
      for (const key of keys) {
        if (ids.includes(key)) byKey.set(key, item);
      }
    }

    const items = (
      await Promise.all(
        entries.map((entry) => resolveEntryItem(entry, byKey, req.signal))
      )
    ).filter(Boolean);

    return Response.json({ items });
  } catch (err) {
    if (isAbortError(err)) {
      return Response.json({ items: [] });
    }
    console.error("POST /api/catalog/history", err);
    return Response.json({ items: [] }, { status: 500 });
  }
}
