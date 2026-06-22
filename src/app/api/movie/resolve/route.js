import clientPromise from "@/lib/mongo";
import {
  enrichCatalogDocGenres,
  findCatalogDocByResolveId,
  imdbGenresFromOmdbForTmdbId,
  normalizeCatalogResolveFallback,
} from "@/lib/catalogResolve";

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id")?.trim();
    if (!id) {
      return Response.json({ error: "Missing id" }, { status: 400 });
    }

    const client = await clientPromise;
    const collection = client.db("teavie").collection("content");

    let doc = await findCatalogDocByResolveId(collection, "movie", id);

    const numeric = Number(id);
    const isNumericId = Number.isFinite(numeric) && numeric > 0;

    if (!doc && isNumericId) {
      const imdb_genres = await imdbGenresFromOmdbForTmdbId(numeric, "movie");
      return Response.json({
        playerId: numeric,
        imdbId: null,
        fallback: imdb_genres.length
          ? { id: String(numeric), imdb_genres, omdb: null }
          : null,
      });
    }

    if (!doc) {
      return Response.json({ error: "Movie not found" }, { status: 404 });
    }

    const merged = await enrichCatalogDocGenres(doc, "movie", {
      persistCollection: collection,
    });

    let tmdbIdNum =
      typeof merged.tmdb_id === "number"
        ? merged.tmdb_id
        : typeof merged.tmdb_id === "string"
          ? Number(merged.tmdb_id)
          : Number(merged.id);

    const { _id, ...docForFallback } = merged;

    return Response.json({
      playerId: Number.isFinite(tmdbIdNum) && tmdbIdNum > 0 ? tmdbIdNum : null,
      imdbId: typeof merged.imdb_id === "string" ? merged.imdb_id : null,
      fallback: normalizeCatalogResolveFallback(docForFallback, "movie"),
    });
  } catch (err) {
    console.error(err);
    return Response.json({ error: "Failed to resolve movie id" }, { status: 500 });
  }
}
