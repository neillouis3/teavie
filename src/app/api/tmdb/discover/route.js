/**
 * Discover rails: TMDB defines order; tiles come from teavie.content.
 */

import { loadTmdbDiscoverRails } from "@/lib/api/tmdbDiscoverRails";

export async function GET() {
  try {
    const payload = await loadTmdbDiscoverRails();
    if (payload.error) {
      return Response.json(
        { error: payload.error, trendingMovies: [], trendingTv: [], popularMovies: [], popularTv: [] },
        { status: 500 }
      );
    }
    const { error: _e, ...rails } = payload;
    return Response.json(rails);
  } catch (err) {
    console.error(err);
    return Response.json(
      { error: "discover failed", trendingMovies: [], trendingTv: [], popularMovies: [], popularTv: [] },
      { status: 500 }
    );
  }
}
