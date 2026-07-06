"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAnimeSource } from "@/contexts/animeSourceContext";
import VideoEmbedFrame from "@/components/videoEmbedFrame";
import { PlayerEmbedSkeleton } from "@/components/ui/playerEmbedSkeleton";
import StreamQualityBadge from "@/components/ui/streamQualityBadge";
import {
  sanitizeAnimeEmbedUrl,
  withMegaPlayStartTime,
} from "@/lib/animePlayEmbed";
import { isMegaPlayEmbedUrl } from "@/lib/megaPlayProgress";

/**
 * @param {object} props
 * @param {number} props.malId MAL anime id (`anime_{malId}` catalog routes)
 * @param {number} props.episode 1-based absolute episode index
 * @param {"sub" | "dub"} props.audio
 * @param {number} [props.startSeconds] MegaPlay resume offset
 * @param {(msg: import('@/lib/megaPlayProgress').MegaPlayMessage) => void} [props.onMegaPlayMessage]
 */
export default function AnimePlayer({
  malId,
  episode,
  audio = "sub",
  startSeconds = 0,
  onMegaPlayMessage,
}) {
  const { source: animeSource } = useAnimeSource();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [primaryUrl, setPrimaryUrl] = useState("");
  const [fallbackUrl, setFallbackUrl] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    setPrimaryUrl("");
    setFallbackUrl("");

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
  }, [malId, episode, audio]);

  const preferredRaw = animeSource === "anikoto" ? fallbackUrl : primaryUrl;
  const alternateRaw = animeSource === "anikoto" ? primaryUrl : fallbackUrl;
  const preferredUrl = sanitizeAnimeEmbedUrl(preferredRaw);
  const alternateUrl = sanitizeAnimeEmbedUrl(alternateRaw);
  const activeRaw = preferredUrl || alternateUrl || primaryUrl;
  const isMegaPlay = isMegaPlayEmbedUrl(activeRaw);

  const activeUrl = useMemo(() => {
    if (!activeRaw) return "";
    if (!isMegaPlay || startSeconds <= 0) return activeRaw;
    return withMegaPlayStartTime(activeRaw, startSeconds) || activeRaw;
  }, [activeRaw, isMegaPlay, startSeconds]);

  const progressHandler = useCallback(
    (msg) => {
      onMegaPlayMessage?.(msg);
    },
    [onMegaPlayMessage]
  );

  const playerKey = `${animeSource}-${malId}-${episode}-${activeUrl}`;

  if (error) {
    return (
      <div className="flex h-full min-h-0 w-full items-center justify-center rounded-lg bg-black p-4 ring-1 ring-white/10">
        <p className="text-sm text-red-400">Error loading video: {error}</p>
      </div>
    );
  }

  return (
    <div className="relative flex h-full min-h-0 w-full touch-auto flex-col rounded-lg bg-black ring-1 ring-white/10 [touch-action:pan-x_pan-y_pinch-zoom] lg:overflow-hidden">
      <StreamQualityBadge quality="hd" />
      <div className="relative min-h-0 flex-1">
        {loading ? (
          <PlayerEmbedSkeleton />
        ) : activeUrl ? (
          <VideoEmbedFrame
            key={playerKey}
            title="Anime player"
            src={activeUrl}
            className="absolute inset-0 h-full w-full border-0"
            onMegaPlayMessage={isMegaPlay ? progressHandler : undefined}
          />
        ) : (
          <p className="absolute inset-0 flex items-center justify-center p-4 text-sm text-white/70">
            No playback source available
          </p>
        )}
      </div>
    </div>
  );
}
