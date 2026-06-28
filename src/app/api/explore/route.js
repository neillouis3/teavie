import { loadTmdbDiscoverRails } from "@/lib/api/tmdbDiscoverRails";
import { loadPopularGenres } from "@/lib/api/popularGenres";

export async function GET() {
  try {
    const [discover, genres] = await Promise.all([
      loadTmdbDiscoverRails(),
      loadPopularGenres(false),
    ]);

    if (discover.error) {
      return Response.json(
        { error: discover.error, discover: { trendingMovies: [], trendingTv: [], popularMovies: [], popularTv: [] }, genres: [] },
        { status: 500 }
      );
    }

    const { error: _e, ...discoverPayload } = discover;
    return Response.json({ discover: discoverPayload, genres });
  } catch (err) {
    console.error(err);
    return Response.json(
      {
        error: "explore failed",
        discover: { trendingMovies: [], trendingTv: [], popularMovies: [], popularTv: [] },
        genres: [],
      },
      { status: 500 }
    );
  }
}
