import { buildAnimePlayAniListUrl } from "@/lib/animePlayEmbed";
import { resolveAnikotoFallbackEmbedUrl } from "@/lib/anikotoApi";

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const anilistId = parseInt(searchParams.get("anilistId") ?? "", 10);
    const episode = parseInt(searchParams.get("episode") ?? "1", 10);
    const audio = searchParams.get("audio") === "dub" ? "dub" : "sub";

    if (!Number.isFinite(anilistId) || anilistId <= 0) {
      return Response.json({ error: "Provide a valid anilistId" }, { status: 400 });
    }

    const ep = Math.max(1, Number.isFinite(episode) ? episode : 1);
    const primaryUrl = buildAnimePlayAniListUrl(anilistId, ep, audio);

    let fallbackUrl = null;
    try {
      fallbackUrl = await resolveAnikotoFallbackEmbedUrl({
        anilistId,
        episode: ep,
        audio,
      });
    } catch (e) {
      console.error("Anikoto fallback lookup failed:", e);
    }

    return Response.json({
      primaryUrl,
      fallbackUrl,
      fallbackAvailable: Boolean(fallbackUrl),
    });
  } catch (err) {
    console.error(err);
    return Response.json({ error: "Failed to resolve anime embed" }, { status: 500 });
  }
}
