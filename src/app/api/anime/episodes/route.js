/**
 * GET /api/anime/episodes?malId=21&limit=200
 * Jikan episode list for anime without a TMDB season mapping.
 */
import { fetchJikanAnimeEpisodes } from "@/lib/jikanEpisodes";

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const malId = parseInt(searchParams.get("malId") ?? "", 10);
    const limit = Math.min(
      500,
      Math.max(1, parseInt(searchParams.get("limit") || "200", 10))
    );

    if (!Number.isFinite(malId) || malId <= 0) {
      return Response.json({ error: "Invalid malId" }, { status: 400 });
    }

    const episodes = await fetchJikanAnimeEpisodes(malId, limit);
    if (!episodes.length) {
      return Response.json({ error: "No episodes found" }, { status: 404 });
    }

    return Response.json({
      source: "jikan",
      malId,
      episodeCount: episodes.length,
      episodes,
    });
  } catch (err) {
    console.error("[anime/episodes]", err);
    return Response.json({ error: "Failed to fetch anime episodes" }, { status: 500 });
  }
}
