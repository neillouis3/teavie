import { loadTmdbYouMightLike } from "@/lib/api/youMightLike";

const MAX_LIMIT = 24;

/**
 * GET ?type=movie|tv&id=<tmdbId>&limit=
 */
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const mediaType = searchParams.get("type") === "tv" ? "tv" : "movie";
    const id = searchParams.get("id")?.trim() ?? "";
    const limitRaw = searchParams.get("limit");
    const parsedLimit = limitRaw ? parseInt(limitRaw, 10) : NaN;
    const limit =
      Number.isFinite(parsedLimit) && parsedLimit > 0
        ? Math.min(parsedLimit, MAX_LIMIT)
        : 8;

    if (!/^\d+$/.test(id)) {
      return Response.json(
        { error: "Provide a valid TMDB id", items: [] },
        { status: 400 }
      );
    }

    const items = await loadTmdbYouMightLike(mediaType, id, limit);
    return Response.json(
      { items },
      {
        headers: {
          "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=600",
        },
      }
    );
  } catch (err) {
    console.error("GET /api/tmdb/you-might-like", err);
    return Response.json({ items: [] }, { status: 200 });
  }
}
