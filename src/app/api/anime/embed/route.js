import {
  buildAnimePlayAniListUrl,
  buildAnimePlayMalUrl,
  sanitizeAnimeEmbedUrl,
} from "@/lib/animePlayEmbed";
import { normalizeSplitCourMalEpisode, resolveSplitCourPlayback, splitCourGroupForMal, animePlayMalEmbedTarget } from "@/lib/animeSplitCour";
import { resolveAnikotoEpisodePlayback } from "@/lib/anikotoApi";
import { lookupKometaByMalId } from "@/lib/kometaAnimeIds";
import { anilistIdFromMalId } from "@/lib/malToAnilistId";

function buildAlternateAudioUrl(malEmbedId, malEmbedEp, anilistId, playbackEp, audio) {
  const oppositeAudio = audio === "dub" ? "sub" : "dub";
  const alternateAudioMalUrl = buildAnimePlayMalUrl(
    malEmbedId,
    malEmbedEp,
    oppositeAudio
  );
  const alternateAudioAniUrl =
    anilistId != null && anilistId > 0
      ? buildAnimePlayAniListUrl(anilistId, playbackEp, oppositeAudio)
      : "";
  return (
    sanitizeAnimeEmbedUrl(alternateAudioMalUrl) ||
    sanitizeAnimeEmbedUrl(alternateAudioAniUrl) ||
    null
  );
}

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

    const [kometa, anilistFromMal, anikotoPlayback] = await Promise.all([
      lookupKometaByMalId(playback.malId),
      anilistIdFromMalId(playback.malId).catch(() => null),
      resolveAnikotoEpisodePlayback({
        malId: playback.malId,
        anilistId: playback.anilistId ?? undefined,
        episode: playback.malEpisode,
        audio,
      }).catch(() => null),
    ]);

    const anilistId =
      playback.anilistId ?? kometa?.anilistId ?? anilistFromMal ?? null;

    const alternateAudioUrl = buildAlternateAudioUrl(
      malEmbedId,
      malEmbedEp,
      anilistId,
      playback.malEpisode,
      audio
    );

    if (
      audio === "dub" &&
      anikotoPlayback?.episodeFound &&
      !anikotoPlayback.audioAvailable
    ) {
      return Response.json({
        primaryUrl: "",
        fallbackUrl: "",
        fallbackAvailable: false,
        alternateAudioUrl,
        audioAvailable: false,
        malId: malEmbedId,
        malEpisode: malEmbedEp,
        anilistId: anilistId ?? null,
      });
    }

    const malUrl = buildAnimePlayMalUrl(malEmbedId, malEmbedEp, audio);
    const aniUrl =
      anilistId != null && anilistId > 0
        ? buildAnimePlayAniListUrl(anilistId, playback.malEpisode, audio)
        : "";

    const primaryUrl =
      sanitizeAnimeEmbedUrl(malUrl) || sanitizeAnimeEmbedUrl(aniUrl) || "";
    const megaPlayAlt =
      sanitizeAnimeEmbedUrl(aniUrl) && sanitizeAnimeEmbedUrl(aniUrl) !== primaryUrl
        ? sanitizeAnimeEmbedUrl(aniUrl)
        : null;
    const fallbackUrl = megaPlayAlt || sanitizeAnimeEmbedUrl(malUrl);
    const anikotoUrl = anikotoPlayback?.embedUrl ?? null;

    return Response.json({
      primaryUrl,
      fallbackUrl: anikotoUrl || fallbackUrl,
      fallbackAvailable: Boolean(anikotoUrl || fallbackUrl),
      alternateAudioUrl,
      audioAvailable: anikotoPlayback?.episodeFound
        ? anikotoPlayback.audioAvailable
        : true,
      malId: malEmbedId,
      malEpisode: malEmbedEp,
      anilistId: anilistId ?? null,
    });
  } catch (err) {
    console.error(err);
    return Response.json({ error: "Failed to resolve anime embed" }, { status: 500 });
  }
}
