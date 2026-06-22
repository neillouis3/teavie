import clientPromise from "@/lib/mongo";
import { resolveTmdbTvFromDoc } from "@/lib/tmdbResolveFromTitle";
import { tmdbBearerToken } from "@/lib/tmdbAuth";

function normalizeDate(dateValue) {
  if (dateValue == null) return null;
  if (typeof dateValue === "string") return dateValue;
  return dateValue.toISOString?.().split("T")[0] ?? null;
}

function pickNumericAnilistId(doc) {
  const raw = doc?.anilist_id ?? doc?.anilist?.id;
  if (typeof raw === "number" && Number.isFinite(raw) && raw > 0) return raw;
  if (typeof raw === "string") {
    const n = parseInt(raw, 10);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return null;
}

function normalizeFallback(doc) {
  return {
    id: doc.id,
    name: doc.name ?? doc.title ?? "Untitled",
    first_air_date: normalizeDate(doc.first_air_date ?? doc.release_date ?? null),
    overview: doc.overview ?? "",
    poster_path: doc.poster_path ?? null,
    backdrop_path: doc.backdrop_path ?? null,
    vote_average: typeof doc.vote_average === "number" ? doc.vote_average : 0,
    status: typeof doc.status === "string" && doc.status ? doc.status : "Released",
    genres: Array.isArray(doc.genres) ? doc.genres : [],
    imdb_genres: Array.isArray(doc.imdb_genres) ? doc.imdb_genres : [],
    origin_country: Array.isArray(doc.origin_country) ? doc.origin_country : [],
    original_language:
      typeof doc.original_language === "string" ? doc.original_language : null,
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

    const doc = await collection.findOne(
      { type: "tv", id },
      {
        projection: {
          _id: 1,
          id: 1,
          tmdb_id: 1,
          imdb_id: 1,
          title: 1,
          name: 1,
          first_air_date: 1,
          release_date: 1,
          overview: 1,
          poster_path: 1,
          backdrop_path: 1,
          vote_average: 1,
          season_amount: 1,
          number_of_seasons: 1,
          number_of_episodes: 1,
          is_anime: 1,
          tags: 1,
          anilist_id: 1,
          anilist: 1,
          external_ids: 1,
          mal_id: 1,
          genres: 1,
          imdb_genres: 1,
          is_kdrama: 1,
          catalog_categories: 1,
          origin_country: 1,
          original_language: 1,
          status: 1,
        },
      }
    );

    if (!doc) {
      // Numeric ids can still be treated as TMDB ids for old routes.
      const numeric = Number(id);
      if (Number.isFinite(numeric) && numeric > 0) {
        return Response.json({ playerId: numeric, imdbId: null, fallback: null });
      }
      return Response.json({ error: "Show not found" }, { status: 404 });
    }

    let tmdbIdNum =
      typeof doc.tmdb_id === "number"
        ? doc.tmdb_id
        : typeof doc.tmdb_id === "string"
          ? Number(doc.tmdb_id)
          : Number(doc.id);

    let merged = { ...doc };
    const hasPlayer = Number.isFinite(tmdbIdNum) && tmdbIdNum > 0;

    const token = tmdbBearerToken();
    if (!hasPlayer && token && doc._id) {
      try {
        const hit = await resolveTmdbTvFromDoc(doc, token);
        if (hit) {
          const setDoc = {
            tmdb_id: hit.tmdbId,
            imdb_id: hit.imdbId,
            last_tmdb_resolved_at: new Date().toISOString(),
          };
          if (hit.poster_path) setDoc.poster_path = hit.poster_path;
          if (hit.backdrop_path) setDoc.backdrop_path = hit.backdrop_path;
          await collection.updateOne({ _id: doc._id }, { $set: setDoc });
          merged = {
            ...merged,
            tmdb_id: hit.tmdbId,
            imdb_id: hit.imdbId,
            poster_path: hit.poster_path || merged.poster_path,
            backdrop_path: hit.backdrop_path || merged.backdrop_path,
          };
          tmdbIdNum = hit.tmdbId;
        }
      } catch (e) {
        console.error("Lazy TMDB resolve failed:", e);
      }
    }

    const { _id, ...docForFallback } = merged;

    return Response.json({
      playerId: Number.isFinite(tmdbIdNum) && tmdbIdNum > 0 ? tmdbIdNum : null,
      imdbId: typeof merged.imdb_id === "string" ? merged.imdb_id : null,
      fallback: normalizeFallback(docForFallback),
    });
  } catch (err) {
    console.error(err);
    return Response.json({ error: "Failed to resolve show id" }, { status: 500 });
  }
}

