import {
  loadMovieCollectionForMovie,
  loadMovieCollectionPayload,
} from "@/lib/api/movieCollectionRails";
import { CATALOG_BROWSE_CACHE_HEADERS } from "@/lib/api/catalogBrowsePage";

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const movieId = searchParams.get("movieId") ?? searchParams.get("id");
    const collectionId = searchParams.get("collectionId");
    const includeCurrent = searchParams.get("includeCurrent") === "1";

    let payload;
    if (collectionId && /^\d+$/.test(collectionId)) {
      payload = await loadMovieCollectionPayload(collectionId, {
        excludeMovieId: includeCurrent ? undefined : movieId,
      });
    } else if (movieId && /^\d+$/.test(String(movieId))) {
      payload = await loadMovieCollectionForMovie(movieId, {
        excludeCurrent: !includeCurrent,
      });
    } else {
      return Response.json(
        { error: "movieId or collectionId required" },
        { status: 400 }
      );
    }

    return Response.json(payload, { headers: CATALOG_BROWSE_CACHE_HEADERS });
  } catch (err) {
    console.error("GET /api/movie/collection", err);
    return Response.json({ collection: null, items: [] }, { status: 500 });
  }
}
