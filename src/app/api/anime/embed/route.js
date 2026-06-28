import {
  buildAnimePlayMalUrl,
  sanitizeAnimeEmbedUrl,
} from "@/lib/animePlayEmbed";
import { resolveAnikotoFallbackEmbedUrl } from "@/lib/anikotoApi";
import { anilistIdFromMalId } from "@/lib/malToAnilistId";

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const malId = parseInt(searchParams.get("malId") ?? "", 10);
    const episode = parseInt(searchParams.get("episode") ?? "1", 10);
    const audio = searchParams.get("audio") === "dub" ? "dub" : "sub";

    if (!Number.isFinite(malId) || malId <= 0) {
      return Response.json({ error: "Provide a valid malId" }, { status: 400 });
    }

    const ep = Math.max(1, Number.isFinite(episode) ? episode : 1);
    const primaryUrl = buildAnimePlayMalUrl(malId, ep, audio);

    let fallbackUrl = null;
    try {
      const anilistId = await anilistIdFromMalId(malId);
      if (anilistId) {
        const raw = await resolveAnikotoFallbackEmbedUrl({
          anilistId,
          episode: ep,
          audio,
        });
        fallbackUrl = sanitizeAnimeEmbedUrl(raw);
      }
    } catch (e) {
      console.error("Anikoto fallback lookup failed:", e);
    }

    return Response.json({
      primaryUrl,
      fallbackUrl,
      fallbackAvailable: Boolean(fallbackUrl),
      malId,
    });
  } catch (err) {
    console.error(err);
    return Response.json({ error: "Failed to resolve anime embed" }, { status: 500 });
  }
}
