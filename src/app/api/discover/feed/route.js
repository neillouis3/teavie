import { loadDiscoverFeed } from "@/lib/api/discoverFeed";
import { EXPLORE_CACHE_HEADERS } from "@/lib/api/exploreCache";

export async function GET() {
  try {
    const feed = await loadDiscoverFeed();
    return Response.json(feed, { headers: EXPLORE_CACHE_HEADERS });
  } catch (err) {
    console.error(err);
    return Response.json(
      { newContent: [], updatedContent: [], upcomingContent: [], error: "feed failed" },
      { status: 500 }
    );
  }
}
