/**
 * TMDB movie collection / franchise rails (Scooby-Doo, MCU, etc.).
 */

import clientPromise from "@/lib/mongo";
import {
  catalogMoviePolicyClause,
  catalogTodayIsoUtc,
  releasedCatalogClause,
} from "@/lib/catalogQuery";
import { mapCatalogListDoc } from "@/lib/mapContentDocToItem";
import { isBlockedMovieTmdbId } from "@/lib/tmdbMovieContentPolicy";
import { tmdbFetchJson } from "@/lib/tmdbAuth";

const DEFAULT_LIMIT = 48;

export function collectionIdFromDoc(doc) {
  if (!doc || typeof doc !== "object") return null;
  const direct = Number(doc.tmdb_collection_id);
  if (Number.isFinite(direct) && direct > 0) return direct;
  const nested = doc.belongs_to_collection;
  if (nested && typeof nested === "object") {
    const id = Number(nested.id);
    if (Number.isFinite(id) && id > 0) return id;
  }
  return null;
}

export function collectionMetaFromDoc(doc) {
  const id = collectionIdFromDoc(doc);
  if (!id) return null;
  const nested = doc.belongs_to_collection;
  const name =
    (typeof doc.tmdb_collection_name === "string" && doc.tmdb_collection_name.trim()) ||
    (nested && typeof nested.name === "string" ? nested.name.trim() : "") ||
    "Collection";
  const poster_path =
    (typeof doc.tmdb_collection_poster_path === "string" &&
      doc.tmdb_collection_poster_path) ||
    (nested && typeof nested.poster_path === "string" ? nested.poster_path : null) ||
    null;
  const backdrop_path =
    (typeof doc.tmdb_collection_backdrop_path === "string" &&
      doc.tmdb_collection_backdrop_path) ||
    (nested && typeof nested.backdrop_path === "string" ? nested.backdrop_path : null) ||
    null;
  return { id, name, poster_path, backdrop_path };
}

function collectionMatchClause(collectionId) {
  const id = Number(collectionId);
  return {
    $or: [
      { tmdb_collection_id: id },
      { "belongs_to_collection.id": id },
    ],
  };
}

async function loadCollectionMoviesFromMongo(collectionId, { excludeMovieId } = {}) {
  const todayIso = catalogTodayIsoUtc();
  const client = await clientPromise;
  const col = client.db("teavie").collection("content");

  const filter = {
    $and: [
      { type: "movie" },
      catalogMoviePolicyClause(),
      collectionMatchClause(collectionId),
      releasedCatalogClause("release_date", todayIso),
    ],
  };

  const docs = await col
    .find(filter, {
      projection: {
        id: 1,
        title: 1,
        name: 1,
        release_date: 1,
        poster_path: 1,
        backdrop_path: 1,
        vote_average: 1,
        vote_count: 1,
        omdb: 1,
        runtimeSeconds: 1,
        runtime: 1,
        imdb_genres: 1,
        type: 1,
        tmdb_collection_id: 1,
        belongs_to_collection: 1,
      },
    })
    .sort({ release_date: 1, id: 1 })
    .limit(DEFAULT_LIMIT)
    .toArray();

  const exclude = String(excludeMovieId ?? "").trim();
  return docs
    .filter((doc) => {
      const docId = String(doc.id);
      if (exclude && docId === exclude) return false;
      if (isBlockedMovieTmdbId(docId)) return false;
      return true;
    })
    .map(mapCatalogListDoc);
}

async function fetchTmdbCollection(collectionId) {
  try {
    return await tmdbFetchJson(
      `https://api.themoviedb.org/3/collection/${collectionId}?language=en-US`
    );
  } catch {
    return null;
  }
}

async function enrichTmdbPartsWithCatalog(parts, { excludeMovieId } = {}) {
  if (!Array.isArray(parts) || parts.length === 0) return [];

  const orderedIds = parts
    .map((p) => Number(p?.id))
    .filter((id) => Number.isFinite(id) && id > 0 && !isBlockedMovieTmdbId(String(id)));

  if (orderedIds.length === 0) return [];

  const idVariants = [...orderedIds, ...orderedIds.map(String)];
  const client = await clientPromise;
  const docs = await client
    .db("teavie")
    .collection("content")
    .find({
      $and: [
        { type: "movie" },
        { $or: [{ id: { $in: idVariants } }, { tmdb_id: { $in: orderedIds } }] },
        catalogMoviePolicyClause(),
      ],
    },
      {
        projection: {
          id: 1,
          title: 1,
          name: 1,
          release_date: 1,
          poster_path: 1,
          backdrop_path: 1,
          vote_average: 1,
          vote_count: 1,
          omdb: 1,
          runtimeSeconds: 1,
          runtime: 1,
          imdb_genres: 1,
          type: 1,
        },
      }
    )
    .toArray();

  const byTmdb = new Map();
  for (const doc of docs) {
    const key = Number(doc.id) || Number(doc.tmdb_id);
    if (Number.isFinite(key) && key > 0) byTmdb.set(key, doc);
  }

  const exclude = String(excludeMovieId ?? "").trim();
  const out = [];
  for (const tmdbId of orderedIds) {
    if (exclude && String(tmdbId) === exclude) continue;
    const doc = byTmdb.get(tmdbId);
    if (doc) out.push(mapCatalogListDoc(doc));
  }
  return out;
}

/**
 * @param {number | string} collectionId
 * @param {{ excludeMovieId?: string | number; movieId?: string | number }} [opts]
 */
export async function loadMovieCollectionPayload(collectionId, opts = {}) {
  const id = Number(collectionId);
  if (!Number.isFinite(id) || id <= 0) {
    return { collection: null, items: [] };
  }

  const excludeMovieId = opts.excludeMovieId ?? opts.movieId;

  let mongoItems = await loadCollectionMoviesFromMongo(id, { excludeMovieId });

  let tmdbCollection = null;
  if (mongoItems.length < 2) {
    tmdbCollection = await fetchTmdbCollection(id);
    if (tmdbCollection?.parts?.length) {
      const enriched = await enrichTmdbPartsWithCatalog(tmdbCollection.parts, {
        excludeMovieId,
      });
      if (enriched.length > mongoItems.length) {
        mongoItems = enriched;
      }
    }
  }

  const name =
    (typeof tmdbCollection?.name === "string" && tmdbCollection.name.trim()) ||
    mongoItems[0]?.title ||
    "Collection";

  return {
    collection: {
      id,
      name,
      poster_path: tmdbCollection?.poster_path ?? mongoItems[0]?.poster_path ?? null,
      backdrop_path: tmdbCollection?.backdrop_path ?? mongoItems[0]?.backdrop_path ?? null,
      overview:
        typeof tmdbCollection?.overview === "string"
          ? tmdbCollection.overview.trim()
          : "",
    },
    items: mongoItems,
  };
}

/**
 * Resolve collection for a catalog movie id (TMDB numeric id).
 * @param {string | number} movieId
 * @param {{ excludeCurrent?: boolean }} [opts]
 */
export async function loadMovieCollectionForMovie(movieId, opts = {}) {
  const idStr = String(movieId ?? "").trim();
  if (!/^\d+$/.test(idStr)) {
    return { collection: null, items: [] };
  }

  const client = await clientPromise;
  const col = client.db("teavie").collection("content");
  const doc = await col.findOne(
    {
      type: "movie",
      $or: [{ id: idStr }, { id: Number(idStr) }, { tmdb_id: Number(idStr) }],
    },
    {
      projection: {
        id: 1,
        tmdb_collection_id: 1,
        tmdb_collection_name: 1,
        tmdb_collection_poster_path: 1,
        tmdb_collection_backdrop_path: 1,
        belongs_to_collection: 1,
      },
    }
  );

  let collectionMeta = collectionMetaFromDoc(doc);

  if (!collectionMeta) {
    try {
      const tmdbMovie = await tmdbFetchJson(
        `https://api.themoviedb.org/3/movie/${idStr}?language=en-US`
      );
      const btc = tmdbMovie?.belongs_to_collection;
      if (btc && typeof btc.id === "number" && btc.id > 0) {
        collectionMeta = {
          id: btc.id,
          name: btc.name ?? "Collection",
          poster_path: btc.poster_path ?? null,
          backdrop_path: btc.backdrop_path ?? null,
        };
      }
    } catch {
      return { collection: null, items: [] };
    }
  }

  if (!collectionMeta) {
    return { collection: null, items: [] };
  }

  const payload = await loadMovieCollectionPayload(collectionMeta.id, {
    excludeMovieId: opts.excludeCurrent !== false ? idStr : undefined,
  });

  if (!payload.collection?.name && collectionMeta.name) {
    payload.collection = { ...payload.collection, name: collectionMeta.name };
  }

  return payload;
}

/** Fields to set on movie docs from TMDB belongs_to_collection. */
export function tmdbCollectionFieldsFromMovie(movie) {
  const btc = movie?.belongs_to_collection;
  if (!btc || typeof btc !== "object") {
    return {
      tmdb_collection_id: null,
      tmdb_collection_name: null,
      tmdb_collection_poster_path: null,
      tmdb_collection_backdrop_path: null,
    };
  }
  const id = Number(btc.id);
  if (!Number.isFinite(id) || id <= 0) {
    return {
      tmdb_collection_id: null,
      tmdb_collection_name: null,
      tmdb_collection_poster_path: null,
      tmdb_collection_backdrop_path: null,
    };
  }
  return {
    tmdb_collection_id: id,
    tmdb_collection_name:
      typeof btc.name === "string" && btc.name.trim() ? btc.name.trim() : null,
    tmdb_collection_poster_path:
      typeof btc.poster_path === "string" ? btc.poster_path : null,
    tmdb_collection_backdrop_path:
      typeof btc.backdrop_path === "string" ? btc.backdrop_path : null,
  };
}
