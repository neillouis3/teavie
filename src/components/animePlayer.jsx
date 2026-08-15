"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAnimeSource } from "@/contexts/animeSourceContext";
import VideoEmbedFrame from "@/components/videoEmbedFrame";
import { PlayerEmbedSkeleton } from "@/components/ui/playerEmbedSkeleton";
import WatchPlayerBackButton from "@/components/ui/watchPlayerBackButton";
import WatchEmbedUnavailable from "@/components/ui/watchEmbedUnavailable";
import {
  sanitizeAnimeEmbedUrl,
  withMegaPlayStartTime,
} from "@/lib/animePlayEmbed";
import { isMegaPlayEmbedUrl } from "@/lib/megaPlayProgress";
import { cn } from "@/lib/utils";

/**
 * @param {object} props
 * @param {number} props.malId MAL anime id (`anime_{malId}` catalog routes)
 * @param {number} props.episode 1-based absolute episode index
 * @param {"sub" | "dub"} props.audio
 * @param {number} [props.startSeconds] MegaPlay resume offset
 * @param {boolean} [props.immersive] Full-viewport watch page (no rounded shell)
 * @param {string | null} [props.backdropUrl] Blurred backdrop for embed-unavailable state
 * @param {(msg: import('@/lib/megaPlayProgress').MegaPlayMessage) => void} [props.onMegaPlayMessage]
 */
export default function AnimePlayer({
  malId,
  episode,
  audio = "sub",
  startSeconds = 0,
  immersive = false,
  backdropUrl = null,
  onMegaPlayMessage,
}) {
  const { source: animeSource } = useAnimeSource();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [primaryUrl, setPrimaryUrl] = useState("");
  const [fallbackUrl, setFallbackUrl] = useState("");
  const [alternateAudioUrl, setAlternateAudioUrl] = useState("");
  const [urlIndex, setUrlIndex] = useState(0);
  const [embedUnavailable, setEmbedUnavailable] = useState(false);
  const [embedReady, setEmbedReady] = useState(false);
  const [audioAvailable, setAudioAvailable] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    setPrimaryUrl("");
    setFallbackUrl("");
    setAlternateAudioUrl("");
    setUrlIndex(0);
    setEmbedUnavailable(false);
    setEmbedReady(false);
    setAudioAvailable(true);

    const mal = Math.floor(Number(malId));
    const ep = Math.max(1, Math.floor(Number(episode)) || 1);

    if (!Number.isFinite(mal) || mal <= 0) {
      setError("Missing MAL id");
      setLoading(false);
      return;
    }

    const qs = new URLSearchParams({
      malId: String(mal),
      episode: String(ep),
      audio: audio === "dub" ? "dub" : "sub",
    });

    fetch(`/api/anime/embed?${qs.toString()}`)
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body?.error || "Failed to load player");
        }
        return res.json();
      })
      .then((data) => {
        if (cancelled) return;
        const primary = typeof data?.primaryUrl === "string" ? data.primaryUrl : "";
        const fallback = typeof data?.fallbackUrl === "string" ? data.fallbackUrl : "";
        const alternateAudio =
          typeof data?.alternateAudioUrl === "string" ? data.alternateAudioUrl : "";
        if (!primary && !fallback) {
          setError("No playback source available");
          return;
        }
        setPrimaryUrl(primary);
        setFallbackUrl(fallback);
        setAlternateAudioUrl(alternateAudio);
        if (data?.audioAvailable === false) {
          setAudioAvailable(false);
          setEmbedUnavailable(true);
        }
      })
      .catch((e) => {
        if (!cancelled) setError(e?.message || "Failed to load player");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [malId, episode, audio]);

  const preferredRaw = animeSource === "anikoto" ? fallbackUrl : primaryUrl;
  const alternateRaw = animeSource === "anikoto" ? primaryUrl : fallbackUrl;
  const preferredUrl = sanitizeAnimeEmbedUrl(preferredRaw);
  const alternateUrl = sanitizeAnimeEmbedUrl(alternateRaw);

  const urlsToTry = useMemo(() => {
    const list = [];
    if (preferredUrl) list.push(preferredUrl);
    if (alternateUrl && alternateUrl !== preferredUrl) list.push(alternateUrl);
    return list;
  }, [preferredUrl, alternateUrl]);

  const activeRaw = urlsToTry[urlIndex] ?? urlsToTry[0] ?? "";
  const isMegaPlay = isMegaPlayEmbedUrl(activeRaw);

  const activeUrl = useMemo(() => {
    if (!activeRaw) return "";
    if (!isMegaPlay || startSeconds <= 0) return activeRaw;
    return withMegaPlayStartTime(activeRaw, startSeconds) || activeRaw;
  }, [activeRaw, isMegaPlay, startSeconds]);

  const handleEmbedFailure = useCallback(() => {
    setUrlIndex((current) => {
      if (current + 1 < urlsToTry.length) {
        setEmbedReady(false);
        return current + 1;
      }
      setEmbedUnavailable(true);
      return current;
    });
  }, [urlsToTry.length]);

  const handleEmbedProgress = useCallback(() => {
    setEmbedReady(true);
  }, []);

  const progressHandler = useCallback(
    (msg) => {
      onMegaPlayMessage?.(msg);
    },
    [onMegaPlayMessage]
  );

  const playerKey = `${animeSource}-${malId}-${episode}-${audio}-${urlIndex}-${activeUrl}`;
  const unavailableReason =
    audio === "dub" && (!audioAvailable || alternateAudioUrl)
      ? "dub_unavailable"
      : "playback_unavailable";
  const probingEmbed = Boolean(activeUrl) && !embedReady && !embedUnavailable;

  if (error) {
    return (
      <div className={`flex h-full min-h-0 w-full items-center justify-center bg-black p-4 ${immersive ? "" : "rounded-lg ring-1 ring-white/10"}`}>
        <p className="text-sm text-red-400">Error loading video: {error}</p>
      </div>
    );
  }

  return (
    <div className={`relative flex h-full min-h-0 w-full touch-auto flex-col bg-black [touch-action:pan-x_pan-y_pinch-zoom] ${immersive ? "overflow-hidden" : "rounded-lg ring-1 ring-white/10 lg:overflow-hidden"}`}>
      {immersive ? null : <WatchPlayerBackButton />}
      <div className="relative min-h-0 flex-1">
        {loading ? (
          <PlayerEmbedSkeleton />
        ) : embedUnavailable ? (
          <WatchEmbedUnavailable
            reason={unavailableReason}
            backdropUrl={backdropUrl}
            showSwitchToSub={audio === "dub"}
          />
        ) : activeUrl ? (
          <>
            {probingEmbed ? (
              <div className="absolute inset-0 z-10 overflow-hidden">
                {backdropUrl ? (
                  <>
                    <img
                      src={backdropUrl}
                      alt=""
                      aria-hidden
                      className="absolute inset-0 h-full w-full scale-110 object-cover blur-3xl"
                    />
                    <div
                      className="absolute inset-0 bg-black/60 backdrop-blur-md"
                      aria-hidden
                    />
                  </>
                ) : (
                  <PlayerEmbedSkeleton />
                )}
              </div>
            ) : null}
            <VideoEmbedFrame
              key={playerKey}
              title="Anime player"
              src={activeUrl}
              className={cn(
                "absolute inset-0 h-full w-full border-0 transition-opacity duration-300",
                probingEmbed ? "pointer-events-none opacity-0" : "opacity-100"
              )}
              onMegaPlayMessage={isMegaPlay ? progressHandler : undefined}
              onEmbedFailure={isMegaPlay ? handleEmbedFailure : undefined}
              onEmbedProgress={isMegaPlay ? handleEmbedProgress : undefined}
              onLoad={!isMegaPlay ? handleEmbedProgress : undefined}
              embedFailureTimeoutMs={2200}
            />
          </>
        ) : (
          <p className="absolute inset-0 flex items-center justify-center p-4 text-sm text-white/70">
            No playback source available
          </p>
        )}
      </div>
    </div>
  );
}
