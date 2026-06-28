"use client";

import { useEffect, useState } from "react";
import VideoEmbedFrame from "@/components/videoEmbedFrame";
import { PlayerEmbedSkeleton } from "@/components/ui/playerEmbedSkeleton";
import StreamQualityBadge from "@/components/ui/streamQualityBadge";
import { useAnimeSource } from "@/contexts/animeSourceContext";

/**
 * @param {object} props
 * @param {number} props.anilistId
 * @param {number} props.episode 1-based absolute episode index
 * @param {"sub" | "dub"} props.audio
 */
export default function AnimePlayer({ anilistId, episode, audio = "sub" }) {
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

    const id = Math.floor(Number(anilistId));
    const ep = Math.max(1, Math.floor(Number(episode)) || 1);
    if (!Number.isFinite(id) || id <= 0) {
      setError("Missing AniList id");
      setLoading(false);
      return;
    }

    const qs = new URLSearchParams({
      anilistId: String(id),
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
  }, [anilistId, episode, audio]);

  const preferredUrl = animeSource === "anikoto" ? fallbackUrl : primaryUrl;
  const alternateUrl = animeSource === "anikoto" ? primaryUrl : fallbackUrl;
  const activeUrl = preferredUrl || alternateUrl;

  if (error) {
    return (
      <div className="flex h-full min-h-0 w-full items-center justify-center rounded-lg bg-black p-4 ring-1 ring-white/10">
        <p className="text-sm text-red-400">Error loading video: {error}</p>
      </div>
    );
  }

  return (
    <div className="relative flex h-full min-h-0 w-full flex-col overflow-hidden rounded-lg bg-black ring-1 ring-white/10">
      <StreamQualityBadge quality="hd" />
      <div className="relative min-h-0 flex-1">
        {loading ? (
          <PlayerEmbedSkeleton />
        ) : activeUrl ? (
          <VideoEmbedFrame
            key={`${animeSource}-${activeUrl}`}
            title="Anime player"
            src={activeUrl}
            className="absolute inset-0 h-full w-full border-0"
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
