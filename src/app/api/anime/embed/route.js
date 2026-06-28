import {
  buildAnimePlayAniListUrl,
  buildAnimePlayMalUrl,
  sanitizeAnimeEmbedUrl,
} from "@/lib/animePlayEmbed";
import { normalizeSplitCourMalEpisode, resolveSplitCourPlayback, splitCourGroupForMal } from "@/lib/animeSplitCour";
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
    const normalized = normalizeSplitCourMalEpisode(malId, ep);
    const playbackMal = normalized.malId ?? malId;
    const playbackEp = normalized.episode;
    const group = splitCourGroupForMal(playbackMal);
    const playback = group
      ? resolveSplitCourPlayback(group, playbackEp)
      : {
          malId,
          malEpisode: ep,
          anilistId: null,
        };

    const kometa = await lookupKometaByMalId(playback.malId);
    const anilistId =
      playback.anilistId ??
      kometa?.anilistId ??
      (await anilistIdFromMalId(playback.malId).catch(() => null));

    const malUrl = buildAnimePlayMalUrl(playback.malId, playback.malEpisode, audio);
    const aniUrl =
      anilistId != null && anilistId > 0
        ? buildAnimePlayAniListUrl(anilistId, playback.malEpisode, audio)
        : "";

    const primaryUrl = sanitizeAnimeEmbedUrl(aniUrl) || malUrl;
    const fallbackUrl = sanitizeAnimeEmbedUrl(malUrl);

    let anikotoUrl = null;
    if (anilistId) {
      try {
        const raw = await resolveAnikotoFallbackEmbedUrl({
          anilistId,
          episode: playback.malEpisode,
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
      malId: playback.malId,
      malEpisode: playback.malEpisode,
      anilistId: anilistId ?? null,
    });
  } catch (err) {
    console.error(err);
    return Response.json({ error: "Failed to resolve anime embed" }, { status: 500 });
  }
}
