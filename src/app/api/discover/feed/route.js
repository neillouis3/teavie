import { loadDiscoverFeed } from "@/lib/api/discoverFeed";

export async function GET() {
  try {
    const feed = await loadDiscoverFeed();
    return Response.json(feed);
  } catch (err) {
    console.error(err);
    return Response.json(
      { newContent: [], updatedContent: [], upcomingContent: [], error: "feed failed" },
      { status: 500 }
    );
  }
}
