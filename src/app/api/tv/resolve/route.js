import clientPromise from "@/lib/mongo";
import {
  enrichCatalogDocGenres,
  findCatalogDocByResolveId,
  imdbGenresFromOmdbForTmdbId,
  normalizeCatalogResolveFallback,
} from "@/lib/catalogResolve";
import { resolveTmdbTvFromDoc } from "@/lib/tmdbResolveFromTitle";
import { tmdbBearerToken } from "@/lib/tmdbAuth";

function pickNumericAnilistId(doc) {
  const raw = doc?.anilist_id ?? doc?.anilist?.id;
  if (typeof raw === "number" && Number.isFinite(raw) && raw > 0) return raw;
  if (typeof raw === "string") {
    const n = parseInt(raw, 10);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return null;
}

function normalizeTvFallback(doc) {
  const base = normalizeCatalogResolveFallback(doc, "tv");
  return {
    ...base,
    genres: [],
    is_kdrama: doc.is_kdrama === true,
    catalog_categories: Array.isArray(doc.catalog_categories)
      ? doc.catalog_categories
      : [],
    mal_id: typeof doc.mal_id === "number" ? doc.mal_id : null,
    tagline: null,
    number_of_seasons:
      typeof doc.season_amount === "number"
        ? doc.season_amount
        : typeof doc.number_of_seasons === "number"
          ? doc.number_of_seasons
          : null,
    number_of_episodes:
      typeof doc.number_of_episodes === "number" ? doc.number_of_episodes : null,
    seasons: [],
    is_anime: Boolean(doc.is_anime || (Array.isArray(doc.tags) && doc.tags.includes("anime"))),
    anilist_id: pickNumericAnilistId(doc),
    anilist: doc.anilist && typeof doc.anilist === "object" ? doc.anilist : null,
    external_ids: doc.external_ids && typeof doc.external_ids === "object" ? doc.external_ids : null,
  };
}

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id")?.trim();
    if (!id) {
      return Response.json({ error: "Missing id" }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db("teavie");
    const collection = db.collection("content");

    let doc = await findCatalogDocByResolveId(collection, "tv", id);

    const numeric = Number(id);
    const isNumericId = Number.isFinite(numeric) && numeric > 0;

    if (!doc && isNumericId) {
      const imdb_genres = await imdbGenresFromOmdbForTmdbId(numeric, "tv");
      return Response.json({
        playerId: numeric,
        imdbId: null,
        fallback: imdb_genres.length
          ? { id: String(numeric), imdb_genres, omdb: null }
          : null,
      });
    }

    if (!doc) {
      return Response.json({ error: "Show not found" }, { status: 404 });
    }

    let merged = await enrichCatalogDocGenres(doc, "tv", {
      persistCollection: collection,
    });

    let tmdbIdNum =
      typeof merged.tmdb_id === "number"
        ? merged.tmdb_id
        : typeof merged.tmdb_id === "string"
          ? Number(merged.tmdb_id)
          : Number(merged.id);

    const hasPlayer = Number.isFinite(tmdbIdNum) && tmdbIdNum > 0;

    const token = tmdbBearerToken();
    if (!hasPlayer && token && merged._id) {
      try {
        const hit = await resolveTmdbTvFromDoc(merged, token);
        if (hit) {
          const setDoc = {
            tmdb_id: hit.tmdbId,
            imdb_id: hit.imdbId,
            last_tmdb_resolved_at: new Date().toISOString(),
          };
          if (hit.poster_path) setDoc.poster_path = hit.poster_path;
          if (hit.backdrop_path) setDoc.backdrop_path = hit.backdrop_path;
          await collection.updateOne({ _id: merged._id }, { $set: setDoc });
          merged = {
            ...merged,
            tmdb_id: hit.tmdbId,
            imdb_id: hit.imdbId,
            poster_path: hit.poster_path || merged.poster_path,
            backdrop_path: hit.backdrop_path || merged.backdrop_path,
          };
          tmdbIdNum = hit.tmdbId;
          if (hit.imdbId && !merged.omdb?.genre) {
            merged = await enrichCatalogDocGenres(merged, "tv", {
              persistCollection: collection,
            });
          }
        }
      } catch (e) {
        console.error("Lazy TMDB resolve failed:", e);
      }
    }

    const { _id, ...docForFallback } = merged;

    return Response.json({
      playerId: Number.isFinite(tmdbIdNum) && tmdbIdNum > 0 ? tmdbIdNum : null,
      imdbId: typeof merged.imdb_id === "string" ? merged.imdb_id : null,
      fallback: normalizeTvFallback(docForFallback),
    });
  } catch (err) {
    console.error(err);
    return Response.json({ error: "Failed to resolve show id" }, { status: 500 });
  }
}
