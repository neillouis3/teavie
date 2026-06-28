/**
 * GET /api/anime/episodes/detail?malId=16498&episode=1
 * Jikan per-episode detail (synopsis + runtime). No still images.
 */
import { fetchJikanAnimeEpisodeDetail } from "@/lib/jikanEpisodes";

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const malId = parseInt(searchParams.get("malId") ?? "", 10);
    const episode = parseInt(searchParams.get("episode") ?? "", 10);

    if (!Number.isFinite(malId) || malId <= 0) {
      return Response.json({ error: "Invalid malId" }, { status: 400 });
    }
    if (!Number.isFinite(episode) || episode <= 0) {
      return Response.json({ error: "Invalid episode" }, { status: 400 });
    }

    const detail = await fetchJikanAnimeEpisodeDetail(malId, episode);
    if (!detail) {
      return Response.json({ error: "Episode not found" }, { status: 404 });
    }

    return Response.json({
      source: "jikan",
      malId,
      episode,
      ...detail,
    });
  } catch (err) {
    console.error("[anime/episodes/detail]", err);
    return Response.json({ error: "Failed to fetch episode detail" }, { status: 500 });
  }
}
