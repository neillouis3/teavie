import {
  EXPLORE_CACHE_HEADERS,
  getCachedExplorePayload,
} from "@/lib/api/exploreCache";

export async function GET() {
  try {
    const payload = await getCachedExplorePayload();
    return Response.json(payload, { headers: EXPLORE_CACHE_HEADERS });
  } catch (err) {
    console.error(err);
    return Response.json(
      {
        error: "explore failed",
        discover: {
          trendingMovies: [],
          trendingTv: [],
          popularMovies: [],
          popularTv: [],
        },
        genres: [],
        feed: { newContent: [], updatedContent: [], upcomingContent: [] },
      },
      { status: 500 }
    );
  }
}
