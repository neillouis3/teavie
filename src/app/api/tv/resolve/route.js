import clientPromise from "@/lib/mongo";

function normalizeDate(dateValue) {
  if (dateValue == null) return null;
  if (typeof dateValue === "string") return dateValue;
  return dateValue.toISOString?.().split("T")[0] ?? null;
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
    status: "Released",
    genres: [],
    origin_country: [],
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
          _id: 0,
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

    const tmdbIdNum =
      typeof doc.tmdb_id === "number"
        ? doc.tmdb_id
        : typeof doc.tmdb_id === "string"
          ? Number(doc.tmdb_id)
          : Number(doc.id);

    return Response.json({
      playerId: Number.isFinite(tmdbIdNum) && tmdbIdNum > 0 ? tmdbIdNum : null,
      imdbId: typeof doc.imdb_id === "string" ? doc.imdb_id : null,
      fallback: normalizeFallback(doc),
    });
  } catch (err) {
    console.error(err);
    return Response.json({ error: "Failed to resolve show id" }, { status: 500 });
  }
}

