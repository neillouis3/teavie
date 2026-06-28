"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import VideoEmbedFrame from "@/components/videoEmbedFrame";
import { Button } from "@heroui/react";

const PRIMARY_PROBE_MS = 8000;

function isPlayerActivityMessage(data) {
  if (!data || typeof data !== "object") return false;
  const d = /** @type {Record<string, unknown>} */ (data);
  if (d.event === "time" || d.event === "complete") return true;
  if (d.type === "watching-log") return true;
  return false;
}

/**
 * @param {object} props
 * @param {number} props.anilistId
 * @param {number} props.episode 1-based absolute episode index
 * @param {"sub" | "dub"} props.audio
 */
export default function AnimePlayer({ anilistId, episode, audio = "sub" }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [primaryUrl, setPrimaryUrl] = useState("");
  const [fallbackUrl, setFallbackUrl] = useState("");
  const [activeSource, setActiveSource] = useState("primary");
  const [autoFallbackUsed, setAutoFallbackUsed] = useState(false);
  const probeTimerRef = useRef(null);
  const primaryConfirmedRef = useRef(false);

  const clearProbe = useCallback(() => {
    if (probeTimerRef.current) {
      clearTimeout(probeTimerRef.current);
      probeTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    setPrimaryUrl("");
    setFallbackUrl("");
    setActiveSource("primary");
    setAutoFallbackUsed(false);
    primaryConfirmedRef.current = false;
    clearProbe();

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
        if (!primary && fallback) setActiveSource("fallback");
      })
      .catch((e) => {
        if (!cancelled) setError(e?.message || "Failed to load player");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
      clearProbe();
    };
  }, [anilistId, episode, audio, clearProbe]);

  const activeUrl =
    activeSource === "fallback" && fallbackUrl ? fallbackUrl : primaryUrl || fallbackUrl;

  useEffect(() => {
    clearProbe();
    primaryConfirmedRef.current = false;

    if (loading || !primaryUrl || activeSource !== "primary" || !fallbackUrl) return;

    const onMessage = (event) => {
      let data = event.data;
      if (typeof data === "string") {
        try {
          data = JSON.parse(data);
        } catch {
          return;
        }
      }
      if (isPlayerActivityMessage(data)) {
        primaryConfirmedRef.current = true;
        clearProbe();
      }
    };

    window.addEventListener("message", onMessage);
    probeTimerRef.current = setTimeout(() => {
      if (!primaryConfirmedRef.current) {
        setActiveSource("fallback");
        setAutoFallbackUsed(true);
      }
    }, PRIMARY_PROBE_MS);

    return () => {
      window.removeEventListener("message", onMessage);
      clearProbe();
    };
  }, [loading, primaryUrl, fallbackUrl, activeSource, episode, audio, clearProbe]);

  if (error) {
    return (
      <div className="flex h-full min-h-0 w-full items-center justify-center rounded-lg bg-black p-4 ring-1 ring-white/10">
        <p className="text-sm text-red-400">Error loading video: {error}</p>
      </div>
    );
  }

  return (
    <div className="relative flex h-full min-h-0 w-full flex-col overflow-hidden rounded-lg bg-black ring-1 ring-white/10">
      {fallbackUrl && primaryUrl ? (
        <div className="absolute right-2 top-2 z-10 flex gap-1">
          <Button
            size="sm"
            variant={activeSource === "primary" ? "solid" : "flat"}
            color={activeSource === "primary" ? "success" : "default"}
            className="min-w-0 bg-black/70 text-xs text-white backdrop-blur-sm"
            onPress={() => {
              setActiveSource("primary");
              setAutoFallbackUsed(false);
            }}
          >
            MegaPlay
          </Button>
          <Button
            size="sm"
            variant={activeSource === "fallback" ? "solid" : "flat"}
            color={activeSource === "fallback" ? "success" : "default"}
            className="min-w-0 bg-black/70 text-xs text-white backdrop-blur-sm"
            onPress={() => setActiveSource("fallback")}
          >
            Anikoto
          </Button>
        </div>
      ) : null}

      {autoFallbackUsed && activeSource === "fallback" ? (
        <div className="absolute left-2 top-2 z-10 rounded-md bg-black/70 px-2 py-1 text-[11px] text-white/80 backdrop-blur-sm">
          Switched to alternate source
        </div>
      ) : null}

      <div className="relative min-h-0 flex-1">
        {loading ? (
          <p className="absolute inset-0 flex items-center justify-center p-4 text-sm text-white/70">
            Loading player…
          </p>
        ) : activeUrl ? (
          <VideoEmbedFrame
            key={activeUrl}
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
