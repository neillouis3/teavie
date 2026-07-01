/**
 * GET /api/anime/episodes?malId=35760&limit=12
 * Episode metadata for anime catalog rows (flat absolute list; TMDB stills).
 */
import { fetchAnimeTmdbEpisodes } from "@/lib/animeTmdbEpisodes";

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const malId = parseInt(searchParams.get("malId") ?? "", 10);
    const limit = Math.min(
      1500,
      Math.max(1, parseInt(searchParams.get("limit") || "500", 10))
    );

    if (!Number.isFinite(malId) || malId <= 0) {
      return Response.json({ error: "Invalid malId" }, { status: 400 });
    }

    const { episodes, target, totalEpisodes, flat } =
      await fetchAnimeTmdbEpisodes(malId, limit);
    if (!episodes.length) {
      return Response.json(
        { error: target ? "No episodes found" : "TMDB target not resolved" },
        { status: 404 }
      );
    }

    return Response.json({
      source: "tmdb",
      malId,
      flat: Boolean(flat),
      episodeCount: episodes.length,
      totalEpisodes: totalEpisodes ?? episodes.length,
      tmdb: target,
      episodes,
    });
  } catch (err) {
    console.error("[anime/episodes]", err);
    return Response.json({ error: "Failed to fetch anime episodes" }, { status: 500 });
  }
}
