import { tmdbFetchJson } from "@/lib/tmdbAuth";
import { isBlockedMovieTmdbId } from "@/lib/tmdbMovieContentPolicy";

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id")?.trim();
    if (!id || !/^\d+$/.test(id)) {
      return Response.json({ error: "Provide a valid TMDB movie id" }, { status: 400 });
    }

    if (isBlockedMovieTmdbId(id)) {
      return Response.json(
        { error: "content_policy", message: "This title is not available on Teavie." },
        { status: 404 }
      );
    }

    const lite = searchParams.get("lite") === "1";
    const append = lite ? "release_dates" : "release_dates,credits,videos";

    const data = await tmdbFetchJson(
      `https://api.themoviedb.org/3/movie/${id}?language=en-US&append_to_response=${append}`
    );

    return Response.json(data, {
      headers: {
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=600",
      },
    });
  } catch (err) {
    console.error("GET /api/movie/details", err);
    return Response.json({ error: "Failed to fetch movie details" }, { status: 502 });
  }
}
