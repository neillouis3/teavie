/**
 * GET /api/anime/episodes?malId=21&limit=200&tmdbTvId=1429&tmdbSeason=1
 * Jikan episode list (title + air date) with optional TMDB still_path merge.
 */
import { fetchJikanAnimeEpisodes } from "@/lib/jikanEpisodes";
import {
  fetchTmdbSeasonEpisodes,
  tmdbStillPathByEpisode,
} from "@/lib/tmdbSeasonEpisodes";

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const malId = parseInt(searchParams.get("malId") ?? "", 10);
    const limit = Math.min(
      500,
      Math.max(1, parseInt(searchParams.get("limit") || "200", 10))
    );
    const tmdbTvId = searchParams.get("tmdbTvId")?.trim() ?? "";
    const tmdbSeason = Math.max(
      1,
      parseInt(searchParams.get("tmdbSeason") || "1", 10) || 1
    );

    if (!Number.isFinite(malId) || malId <= 0) {
      return Response.json({ error: "Invalid malId" }, { status: 400 });
    }

    const [episodes, tmdbRows] = await Promise.all([
      fetchJikanAnimeEpisodes(malId, limit),
      /^\d+$/.test(tmdbTvId)
        ? fetchTmdbSeasonEpisodes(tmdbTvId, tmdbSeason)
        : Promise.resolve([]),
    ]);

    if (!episodes.length) {
      return Response.json({ error: "No episodes found" }, { status: 404 });
    }

    if (tmdbRows.length) {
      const stills = tmdbStillPathByEpisode(tmdbRows);
      for (const ep of episodes) {
        const still = stills.get(ep.episode_number);
        if (still) ep.still_path = still;
      }
    }

    return Response.json({
      source: "jikan",
      malId,
      episodeCount: episodes.length,
      tmdbStills: /^\d+$/.test(tmdbTvId)
        ? { tvId: tmdbTvId, season: tmdbSeason, matched: episodes.filter((e) => e.still_path).length }
        : null,
      episodes,
    });
  } catch (err) {
    console.error("[anime/episodes]", err);
    return Response.json({ error: "Failed to fetch anime episodes" }, { status: 500 });
  }
}
