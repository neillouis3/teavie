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
import {
  cacheDubUnavailable,
  clearDubUnavailableCache,
  isDubUnavailableCached,
} from "@/lib/animeDubAvailabilityCache";
import { isMegaPlayEmbedUrl } from "@/lib/megaPlayProgress";
import { cn } from "@/lib/utils";

function resolveCoords(malId, episode) {
  const mal = Math.floor(Number(malId));
  const ep = Math.max(1, Math.floor(Number(episode)) || 1);
  return { mal, ep };
}

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
  const { mal, ep } = resolveCoords(malId, episode);
  const dubCachedUnavailable =
    audio === "dub" &&
    Number.isFinite(mal) &&
    mal > 0 &&
    isDubUnavailableCached(mal, ep);

  const { source: animeSource } = useAnimeSource();
  const [loading, setLoading] = useState(() => !dubCachedUnavailable);
  const [error, setError] = useState("");
  const [primaryUrl, setPrimaryUrl] = useState("");
  const [fallbackUrl, setFallbackUrl] = useState("");
  const [urlIndex, setUrlIndex] = useState(0);
  const [embedUnavailable, setEmbedUnavailable] = useState(dubCachedUnavailable);
  const [embedReady, setEmbedReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    if (!Number.isFinite(mal) || mal <= 0) {
      setError("Missing MAL id");
      setLoading(false);
      return;
    }

    const cachedUnavailable =
      audio === "dub" && isDubUnavailableCached(mal, ep);

    setLoading(!cachedUnavailable);
    setError("");
    setPrimaryUrl("");
    setFallbackUrl("");
    setUrlIndex(0);
    setEmbedUnavailable(cachedUnavailable);
    setEmbedReady(false);

    if (cachedUnavailable) return;

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

        if (data?.audioAvailable === false) {
          if (audio === "dub") cacheDubUnavailable(mal, ep);
          setEmbedUnavailable(true);
          return;
        }

        const primary = typeof data?.primaryUrl === "string" ? data.primaryUrl : "";
        const fallback = typeof data?.fallbackUrl === "string" ? data.fallbackUrl : "";
        if (!primary && !fallback) {
          setError("No playback source available");
          return;
        }
        setPrimaryUrl(primary);
        setFallbackUrl(fallback);
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
  }, [mal, ep, audio]);

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

  const markDubUnavailable = useCallback(() => {
    if (audio !== "dub") return;
    cacheDubUnavailable(mal, ep);
    setEmbedUnavailable(true);
  }, [audio, mal, ep]);

  const handleEmbedFailure = useCallback(() => {
    if (audio === "dub") {
      markDubUnavailable();
      return;
    }
    setUrlIndex((current) => {
      if (current + 1 < urlsToTry.length) {
        setEmbedReady(false);
        return current + 1;
      }
      setEmbedUnavailable(true);
      return current;
    });
  }, [audio, markDubUnavailable, urlsToTry.length]);

  const handleEmbedProgress = useCallback(() => {
    if (audio === "dub") clearDubUnavailableCache(mal, ep);
    setEmbedReady(true);
  }, [audio, mal, ep]);

  const progressHandler = useCallback(
    (msg) => {
      onMegaPlayMessage?.(msg);
    },
    [onMegaPlayMessage]
  );

  const playerKey = `${animeSource}-${malId}-${episode}-${audio}-${urlIndex}-${activeUrl}`;
  const dubResolving = audio === "dub" && loading && !embedUnavailable;
  const showDubUnavailable = audio === "dub" && (embedUnavailable || dubResolving);
  const unavailableReason =
    audio === "dub" ? "dub_unavailable" : "playback_unavailable";
  const probingEmbed =
    Boolean(activeUrl) && !embedReady && !embedUnavailable && !dubResolving;

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
        {showDubUnavailable ? (
          <WatchEmbedUnavailable
            reason="dub_unavailable"
            backdropUrl={backdropUrl}
            showSwitchToSub
          />
        ) : embedUnavailable ? (
          <WatchEmbedUnavailable
            reason={unavailableReason}
            backdropUrl={backdropUrl}
            showSwitchToSub={audio === "dub"}
          />
        ) : loading ? (
          <PlayerEmbedSkeleton />
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
              embedFailureTimeoutMs={1200}
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
