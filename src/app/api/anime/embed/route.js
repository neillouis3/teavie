import {
  buildAnimePlayAniListUrl,
  buildAnimePlayMalUrl,
  sanitizeAnimeEmbedUrl,
} from "@/lib/animePlayEmbed";
import { normalizeSplitCourMalEpisode, resolveSplitCourPlayback, splitCourGroupForMal, animePlayMalEmbedTarget } from "@/lib/animeSplitCour";
import { resolveAnikotoFallbackEmbedUrl, resolveAnikotoAudioAvailable } from "@/lib/anikotoApi";
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
    const { malId: malEmbedId, episode: malEmbedEp } = animePlayMalEmbedTarget(malId, ep);
    const normalized = normalizeSplitCourMalEpisode(malId, ep);
    const playbackMal = normalized.malId ?? malId;
    const playbackEp = normalized.episode;
    const group = splitCourGroupForMal(playbackMal);
    const playback = group
      ? resolveSplitCourPlayback(group, playbackEp)
      : {
          malId: malEmbedId,
          malEpisode: malEmbedEp,
          anilistId: null,
        };

    const kometa = await lookupKometaByMalId(playback.malId);
    const anilistId =
      playback.anilistId ??
      kometa?.anilistId ??
      (await anilistIdFromMalId(playback.malId).catch(() => null));

    const malUrl = buildAnimePlayMalUrl(malEmbedId, malEmbedEp, audio);
    const aniUrl =
      anilistId != null && anilistId > 0
        ? buildAnimePlayAniListUrl(anilistId, playback.malEpisode, audio)
        : "";

    const oppositeAudio = audio === "dub" ? "sub" : "dub";
    const alternateAudioMalUrl = buildAnimePlayMalUrl(
      malEmbedId,
      malEmbedEp,
      oppositeAudio
    );
    const alternateAudioAniUrl =
      anilistId != null && anilistId > 0
        ? buildAnimePlayAniListUrl(anilistId, playback.malEpisode, oppositeAudio)
        : "";
    const alternateAudioUrl =
      sanitizeAnimeEmbedUrl(alternateAudioMalUrl) ||
      sanitizeAnimeEmbedUrl(alternateAudioAniUrl) ||
      "";

    const primaryUrl =
      sanitizeAnimeEmbedUrl(malUrl) || sanitizeAnimeEmbedUrl(aniUrl) || "";
    const megaPlayAlt =
      sanitizeAnimeEmbedUrl(aniUrl) && sanitizeAnimeEmbedUrl(aniUrl) !== primaryUrl
        ? sanitizeAnimeEmbedUrl(aniUrl)
        : null;
    const fallbackUrl = megaPlayAlt || sanitizeAnimeEmbedUrl(malUrl);

    let anikotoUrl = null;
    let audioAvailable = true;
    if (anilistId) {
      try {
        const raw = await resolveAnikotoFallbackEmbedUrl({
          malId: playback.malId,
          anilistId,
          episode: playback.malEpisode,
          audio,
        });
        anikotoUrl = sanitizeAnimeEmbedUrl(raw);

        if (audio === "dub") {
          const dubListed = await resolveAnikotoAudioAvailable({
            malId: playback.malId,
            anilistId,
            episode: playback.malEpisode,
            audio: "dub",
          });
          if (dubListed === false) audioAvailable = false;
        }
      } catch (e) {
        console.error("Anikoto fallback lookup failed:", e);
      }
    }

    return Response.json({
      primaryUrl,
      fallbackUrl: anikotoUrl || fallbackUrl,
      fallbackAvailable: Boolean(anikotoUrl || fallbackUrl),
      alternateAudioUrl: alternateAudioUrl || null,
      audioAvailable,
      malId: malEmbedId,
      malEpisode: malEmbedEp,
      anilistId: anilistId ?? null,
    });
  } catch (err) {
    console.error(err);
    return Response.json({ error: "Failed to resolve anime embed" }, { status: 500 });
  }
}
