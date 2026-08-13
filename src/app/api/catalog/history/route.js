/**
 * Batch catalog lookup for watch history cards.
 * POST { entries: [{ catalogId, mediaType }] }
 */
import clientPromise from "@/lib/mongo";
import { mapContentDocToItem } from "@/lib/mapContentDocToItem";
import { isBlockedMovieTmdbId } from "@/lib/tmdbMovieContentPolicy";
import { tmdbFetchJson } from "@/lib/tmdbAuth";

function mapTmdbToItem(entry, data) {
  const voteAverage =
    typeof data.vote_average === "number" && Number.isFinite(data.vote_average)
      ? data.vote_average
      : null;
  if (entry.mediaType === "movie") {
    return {
      id: entry.catalogId,
      type: "movie",
      title: data.title ?? "Unknown",
      release_date: data.release_date ?? null,
      poster_path: data.poster_path ?? "",
      backdrop_path: data.backdrop_path ?? "",
      vote_average: voteAverage,
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
    vote_average: voteAverage,
  };
}

/** All catalog id shapes that may refer to the same Mongo row. */
function expandCatalogLookupIds(rawId) {
  const id = String(rawId ?? "").trim();
  if (!id) return [];
  const out = new Set([id]);
  if (/^\d+$/.test(id)) {
    out.add(`anime_${id}`);
    out.add(Number(id));
  } else if (id.startsWith("anime_")) {
    const tail = id.slice("anime_".length);
    if (/^\d+$/.test(tail)) {
      out.add(tail);
      out.add(Number(tail));
    }
  }
  return [...out];
}

/** MAL ids only come from `anime_` catalog ids; plain TMDB ids collide with unrelated anime. */
function malLookupId(rawId) {
  const id = String(rawId ?? "").trim();
  if (!id.startsWith("anime_")) return null;
  const tail = id.slice("anime_".length);
  return /^\d+$/.test(tail) ? Number(tail) : null;
}

function catalogAliasKeys(doc) {
  const keys = new Set([String(doc.id)]);
  if (typeof doc.tmdb_id === "number" && doc.tmdb_id > 0) {
    keys.add(String(doc.tmdb_id));
  }
  if (typeof doc.mal_id === "number" && doc.mal_id > 0) {
    keys.add(String(doc.mal_id));
    keys.add(`anime_${doc.mal_id}`);
  }
  const idStr = String(doc.id ?? "");
  if (idStr.startsWith("anime_")) {
    const tail = idStr.slice("anime_".length);
    if (tail) keys.add(tail);
  }
  return keys;
}

/** Alias keys can collide across media types (e.g. TMDB movie id vs MAL id), so match on type. */
function lookupCatalogItem(entry, byKey) {
  for (const key of expandCatalogLookupIds(entry.catalogId)) {
    const item = byKey.get(String(key));
    if (!item) continue;
    if (item.type !== entry.mediaType) continue;
    return item;
  }
  return null;
}

async function resolveEntryItem(entry, byKey, reqSignal) {
  if (reqSignal?.aborted) return null;
  if (entry.mediaType === "movie" && isBlockedMovieTmdbId(entry.catalogId)) {
    return null;
  }

  const item = lookupCatalogItem(entry, byKey);
  if (item) return { ...item, id: entry.catalogId };

  if (!/^\d+$/.test(entry.catalogId)) return null;

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

    const lookupIds = new Set();
    const malIds = new Set();
    for (const entry of entries) {
      for (const id of expandCatalogLookupIds(entry.catalogId)) {
        lookupIds.add(typeof id === "number" ? id : String(id));
      }
      const malId = malLookupId(entry.catalogId);
      if (malId != null) malIds.add(malId);
    }
    const idList = [...lookupIds];
    const numeric = idList
      .map((id) => Number(id))
      .filter((n) => Number.isFinite(n) && n > 0);

    const or = [{ id: { $in: idList } }];
    if (numeric.length) {
      or.push({ tmdb_id: { $in: numeric } });
    }
    if (malIds.size) {
      or.push({ mal_id: { $in: [...malIds] } });
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
            mal_id: 1,
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
            vote_average: 1,
            vote_count: 1,
            omdb: 1,
            tmdb: 1,
            anilist: 1,
            tags: 1,
            is_anime: 1,
          },
        }
      )
      .toArray();

    /** @type {Map<string, ReturnType<typeof mapContentDocToItem>>} */
    const byKey = new Map();
    for (const doc of docs) {
      const item = mapContentDocToItem(doc);
      for (const key of catalogAliasKeys(doc)) {
        byKey.set(String(key), item);
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
