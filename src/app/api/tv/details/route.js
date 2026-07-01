import { tmdbFetchJson } from "@/lib/tmdbAuth";

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id")?.trim();
    if (!id || !/^\d+$/.test(id)) {
      return Response.json({ error: "Provide a valid TMDB TV id" }, { status: 400 });
    }

    const data = await tmdbFetchJson(
      `https://api.themoviedb.org/3/tv/${id}?language=en-US&append_to_response=content_ratings`
    );

    return Response.json(data, {
      headers: {
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=600",
      },
    });
  } catch (err) {
    console.error("GET /api/tv/details", err);
    return Response.json({ error: "Failed to fetch TV details" }, { status: 502 });
  }
}
