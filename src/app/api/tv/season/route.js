import { fetchTmdbSeasonEpisodes } from "@/lib/tmdbSeasonEpisodes";

/**
 * GET /api/tv/season?tvId=1399&season=1
 * Returns aired episodes for a TMDB TV season (name, overview, runtime, still_path, air_date).
 */
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const tvId = searchParams.get("tvId")?.trim();
    const seasonRaw = searchParams.get("season");

    if (!tvId || !/^\d+$/.test(tvId)) {
      return Response.json({ error: "Invalid tvId" }, { status: 400 });
    }

    const seasonNum = parseInt(String(seasonRaw ?? ""), 10);
    if (!Number.isFinite(seasonNum) || seasonNum < 0) {
      return Response.json({ error: "Invalid season" }, { status: 400 });
    }

    const episodes = await fetchTmdbSeasonEpisodes(tvId, seasonNum);
    if (!episodes.length) {
      return Response.json(
        { error: "Season not found" },
        { status: 404 }
      );
    }

    return Response.json({
      tvId,
      season: seasonNum,
      episodes,
    });
  } catch (err) {
    console.error("[tv/season]", err);
    return Response.json({ error: "Failed to fetch season" }, { status: 500 });
  }
}
