import {
  buildAnimePlayAniListUrl,
  buildAnimePlayMalUrl,
  sanitizeAnimeEmbedUrl,
} from "@/lib/animePlayEmbed";
import { resolveAnikotoFallbackEmbedUrl } from "@/lib/anikotoApi";
import { lookupKometaByMalId } from "@/lib/kometaAnimeIds";
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

    const kometa = await lookupKometaByMalId(malId);
    const anilistId =
      kometa?.anilistId ??
      (await anilistIdFromMalId(malId).catch(() => null));

    const malUrl = buildAnimePlayMalUrl(malId, ep, audio);
    const aniUrl =
      anilistId != null && anilistId > 0
        ? buildAnimePlayAniListUrl(anilistId, ep, audio)
        : "";

    const primaryUrl = sanitizeAnimeEmbedUrl(aniUrl) || malUrl;
    const fallbackUrl = sanitizeAnimeEmbedUrl(malUrl);

    let anikotoUrl = null;
    if (anilistId) {
      try {
        const raw = await resolveAnikotoFallbackEmbedUrl({
          anilistId,
          episode: ep,
          audio,
        });
        anikotoUrl = sanitizeAnimeEmbedUrl(raw);
      } catch (e) {
        console.error("Anikoto fallback lookup failed:", e);
      }
    }

    return Response.json({
      primaryUrl,
      fallbackUrl: anikotoUrl || fallbackUrl,
      fallbackAvailable: Boolean(anikotoUrl || fallbackUrl),
      malId,
      anilistId: anilistId ?? null,
    });
  } catch (err) {
    console.error(err);
    return Response.json({ error: "Failed to resolve anime embed" }, { status: 500 });
  }
}
