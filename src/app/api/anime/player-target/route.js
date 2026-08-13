import { resolveAnimeTmdbEpisodeTarget } from "@/lib/animeTmdbEpisodes";

/**
 * GET /api/anime/player-target?malId=40028&episode=17
 * TMDB/VidCore coords for an anime catalog row (Kometa + split-cour mapping).
 */
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const malId = parseInt(searchParams.get("malId") ?? "", 10);
    const episode = Math.max(
      1,
      parseInt(searchParams.get("episode") ?? "1", 10) || 1
    );

    if (!Number.isFinite(malId) || malId <= 0) {
      return Response.json({ error: "Invalid malId" }, { status: 400 });
    }

    const target = await resolveAnimeTmdbEpisodeTarget(null, malId, episode);
    if (!target) {
      return Response.json({ error: "TMDB target not resolved" }, { status: 404 });
    }

    return Response.json({
      videoId: target.tvId,
      season: target.season,
      episode: target.episode ?? episode,
      malId: target.malId ?? malId,
      malEpisode: target.malEpisode ?? episode,
    });
  } catch (err) {
    console.error("[anime/player-target]", err);
    return Response.json({ error: "Failed to resolve player target" }, { status: 500 });
  }
}
