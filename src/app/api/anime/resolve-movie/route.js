import clientPromise from "@/lib/mongo";
import { resolveTmdbMovieFromDoc } from "@/lib/tmdbResolveFromTitle";
import { tmdbBearerToken } from "@/lib/tmdbAuth";

function pickCachedMovieId(doc) {
  const raw = doc?.tmdb_movie_id;
  if (typeof raw === "number" && Number.isFinite(raw) && raw > 0) return raw;
  if (typeof raw === "string") {
    const n = Number(raw);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return null;
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
      { id },
      {
        projection: {
          _id: 1,
          id: 1,
          title: 1,
          name: 1,
          release_date: 1,
          first_air_date: 1,
          anilist: 1,
          tmdb_movie_id: 1,
        },
      }
    );

    if (!doc) {
      const numeric = Number(id);
      if (Number.isFinite(numeric) && numeric > 0) {
        return Response.json({ movieId: numeric });
      }
      return Response.json({ error: "Not found" }, { status: 404 });
    }

    let movieId = pickCachedMovieId(doc);

    const token = tmdbBearerToken();
    if (movieId == null && token && doc._id) {
      try {
        const hit = await resolveTmdbMovieFromDoc(doc, token);
        if (hit) {
          movieId = hit.tmdbId;
          await collection.updateOne(
            { _id: doc._id },
            {
              $set: {
                tmdb_movie_id: hit.tmdbId,
                last_tmdb_movie_resolved_at: new Date().toISOString(),
              },
            }
          );
        }
      } catch (e) {
        console.error("Anime movie TMDB resolve failed:", e);
      }
    }

    return Response.json({ movieId: movieId ?? null });
  } catch (err) {
    console.error(err);
    return Response.json({ error: "Failed to resolve anime movie id" }, { status: 500 });
  }
}
