"use client";

import Hls from "hls.js";
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import { Switch } from "@heroui/react";
import {
  AirplayLineIcon,
  ArrowRight01Icon,
  Cancel01Icon,
  ComputerIcon,
  FullscreenIcon,
  GoBackward10SecIcon,
  GoForward10SecIcon,
  HelpCircleIcon,
  PauseIcon,
  PictureInPictureOnIcon,
  PlayIcon,
  Settings01Icon,
  SubtitleIcon,
  VolumeHighIcon,
  VolumeMute01Icon,
} from "@hugeicons/core-free-icons";
import type { ClientMediaCapabilities, PlayableStream } from "@/lib/stremio/types";
import { consumeStreamSource } from "@/lib/stremio/consumeStreamSource";
import { useWatchOverlay } from "@/contexts/watchOverlayContext";

type Props = {
  type: "movie" | "series";
  imdbId?: string | null;
  /** Catalog id used to resolve IMDb when missing from metadata. */
  catalogKey?: string | null;
  season?: number;
  episode?: number;
  startSeconds?: number;
  title?: string;
  posterUrl?: string | null;
  backdropUrl?: string | null;
  onPlaybackProgress?: (seconds: number) => void;
};

type AudioTrack = { audioIndex: number; language: string; title: string | null; codec: string; channels: number | null };

export default function StremioPlayer({
  type,
  imdbId,
  catalogKey,
  season,
  episode,
  startSeconds = 0,
  title = "",
  posterUrl,
  backdropUrl,
  onPlaybackProgress,
}: Props) {
  const router = useRouter();
  const [resolvedImdbId, setResolvedImdbId] = useState<string | null>(() =>
    imdbId ? normalizeImdbId(imdbId) : null
  );
  const [playRequested, setPlayRequested] = useState(false);
  const [resolvingImdb, setResolvingImdb] = useState(false);
  const effectiveImdbId = resolvedImdbId;
  const playerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const rejectedStreamIndexesRef = useRef(new Set<string>());
  const autoSkipCountRef = useRef(0);
  const audioResumeTimeRef = useRef(0);
  const ignorePlaybackErrorsUntilRef = useRef(0);
  const controlsTimerRef = useRef<number | null>(null);
  const lastProgressReportRef = useRef(0);
  const [streams, setStreams] = useState<PlayableStream[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [addonIndex, setAddonIndex] = useState(0);
  const [hasMoreAddons, setHasMoreAddons] = useState(false);
  const [reloadNonce, setReloadNonce] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [muted, setMuted] = useState(false);
  const [needsPlaybackTap, setNeedsPlaybackTap] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [preferredQuality, setPreferredQuality] = useState("1080p");
  const [audioTracks, setAudioTracks] = useState<AudioTrack[]>([]);
  const [selectedAudioIndex, setSelectedAudioIndex] = useState(0);
  const [audioOverrideUrl, setAudioOverrideUrl] = useState<string | null>(null);
  const [playbackSrc, setPlaybackSrc] = useState<string | null>(null);
  const [controlsVisible, setControlsVisible] = useState(true);
  const watchOverlay = useWatchOverlay();
  const playbackStartedRef = useRef(false);

  useEffect(() => {
    setResolvedImdbId(imdbId ? normalizeImdbId(imdbId) : null);
    setPlayRequested(false);
    setResolvingImdb(false);
    setLoading(false);
    setError(null);
    setStreams([]);
    setActiveIndex(0);
    setAddonIndex(0);
    setHasMoreAddons(false);
    autoSkipCountRef.current = 0;
    playbackStartedRef.current = false;
  }, [imdbId, catalogKey, type]);

  const query = useMemo(() => {
    const q = new URLSearchParams({ type, id: effectiveImdbId ?? "" });
    if (type === "series") {
      q.set("season", String(season ?? ""));
      q.set("episode", String(episode ?? ""));
    }
    const caps = detectMediaCapabilities();
    q.set("ac3", caps.ac3 ? "1" : "0");
    q.set("safari", caps.preferSafari ? "1" : "0");
    return q.toString();
  }, [type, effectiveImdbId, season, episode]);

  useEffect(() => {
    setAddonIndex(0);
    setHasMoreAddons(false);
    autoSkipCountRef.current = 0;
    if (playRequested) setReloadNonce((nonce) => nonce + 1);
  }, [query, playRequested]);

  const resolveImdbForPlayback = useCallback(async (): Promise<string | null> => {
    if (effectiveImdbId) return effectiveImdbId;
    const key = String(catalogKey ?? "").trim();
    if (!/^\d+$/.test(key)) return null;
    setResolvingImdb(true);
    try {
      const endpoint = type === "series" ? "/api/tv/resolve" : "/api/movie/resolve";
      const response = await fetch(`${endpoint}?id=${encodeURIComponent(key)}`);
      const body = response.ok ? await response.json() : null;
      const next =
        typeof body?.imdbId === "string" ? normalizeImdbId(body.imdbId) : null;
      setResolvedImdbId(next);
      return next;
    } catch {
      setResolvedImdbId(null);
      return null;
    } finally {
      setResolvingImdb(false);
    }
  }, [catalogKey, effectiveImdbId, type]);

  const beginPlayback = useCallback(async () => {
    setPlayRequested(true);
    setError(null);
    if (effectiveImdbId) return;
    const next = await resolveImdbForPlayback();
    if (!next) {
      setError("No playback source available for this title.");
    }
  }, [effectiveImdbId, resolveImdbForPlayback]);

  useEffect(() => {
    if (!playRequested || !effectiveImdbId) return;
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    setStreams([]);
    setActiveIndex(0);
    rejectedStreamIndexesRef.current.clear();
    autoSkipCountRef.current = 0;

    const collected: PlayableStream[] = [];
    let sawStream = false;

    void consumeStreamSource(
      `/api/streams/source?${query}&addonIndex=${addonIndex}`,
      controller.signal,
      {
        onStream: (index, stream) => {
          sawStream = true;
          collected[index] = stream;
          setStreams([...collected.filter(Boolean)]);
          if (index === 0) setLoading(false);
        },
        onMeta: (meta) => {
          setHasMoreAddons(meta.hasMoreAddons);
          if (!sawStream) {
            const providerError = meta.errors[0]?.message ?? null;
            if (providerError) {
              setError(
                /took too long|timeout/i.test(providerError)
                  ? "Stream addons timed out. They may be slow or overloaded — try again in a moment."
                  : `The configured addon could not return streams: ${providerError}`
              );
            } else if (meta.unsupported > 0) {
              setError(
                `The addon returned ${meta.unsupported} torrent or non-web stream${meta.unsupported === 1 ? "" : "s"}. Configure it with a direct-link provider to use this browser player.`
              );
            } else {
              setError(
                "No streams found for this IMDb id. Check the id, season, and episode, then try again."
              );
            }
          }
        },
        onError: (message) => setError(message),
        onDone: () => setLoading(false),
      }
    );

    return () => controller.abort();
  }, [playRequested, query, effectiveImdbId, addonIndex, reloadNonce]);

  useEffect(() => {
    const stream = streams[activeIndex];
    if (!stream) {
      setPlaybackSrc(null);
      return;
    }
    const sourceUrl = audioOverrideUrl ?? stream.url;
    // Load stream URLs in the browser so IP-pinned CDN links stay tied to the viewer.
    // Server-side HEAD/GET in /api/streams/resolve pins ElfHosted and similar hosts to Vercel.
    setPlaybackSrc(sourceUrl);
  }, [streams, activeIndex, audioOverrideUrl]);

  useEffect(() => {
    const video = videoRef.current;
    const stream = streams[activeIndex];
    if (!video || !stream || !playbackSrc) return;
    const playbackUrl = playbackSrc;
    const isHls = /\.m3u8(?:$|\?)/i.test(playbackUrl);
    let hls: Hls | null = null;

    const resume = () => {
      const resumeAt = audioResumeTimeRef.current || startSeconds;
      if (resumeAt > 0 && Number.isFinite(video.duration)) video.currentTime = resumeAt;
      audioResumeTimeRef.current = 0;
    };
    video.addEventListener("loadedmetadata", resume, { once: true });
    const disableSubtitles = () => {
      for (const track of Array.from(video.textTracks)) {
        if (track.kind === "subtitles" || track.kind === "captions") {
          track.mode = "disabled";
        }
      }
    };
    disableSubtitles();
    video.textTracks.addEventListener("addtrack", disableSubtitles);
    const supportsNativeHls = Boolean(
      video.canPlayType("application/vnd.apple.mpegurl") ||
        video.canPlayType("application/x-mpegURL")
    );
    if (isHls && !supportsNativeHls && Hls.isSupported()) {
      const hlsPlayer = new Hls();
      hlsPlayer.subtitleDisplay = false;
      hlsPlayer.on(Hls.Events.MANIFEST_PARSED, () => {
        hlsPlayer.subtitleTrack = -1;
        hlsPlayer.subtitleDisplay = false;
      });
      hlsPlayer.loadSource(playbackUrl);
      hlsPlayer.attachMedia(video);
      hls = hlsPlayer;
    } else {
      video.src = playbackUrl;
    }
    return () => {
      video.removeEventListener("loadedmetadata", resume);
      video.textTracks.removeEventListener("addtrack", disableSubtitles);
      hls?.destroy();
      video.pause();
      video.removeAttribute("src");
    };
  }, [streams, activeIndex, startSeconds, playbackSrc]);

  const activeStream = streams[activeIndex];
  const streamLabel = `${activeStream?.name ?? ""} ${activeStream?.title ?? ""}`;

  useEffect(() => {
    setAudioTracks([]);
    setSelectedAudioIndex(0);
    setAudioOverrideUrl(null);
  }, [activeStream]);

  const selectAudioTrack = (audioIndex: number) => {
    if (!activeStream?.remuxUrl) return;
    audioResumeTimeRef.current = videoRef.current?.currentTime || 0;
    setSelectedAudioIndex(audioIndex);
    setAudioOverrideUrl(`${activeStream.remuxUrl}&audio=${audioIndex}`);
  };

  const selectQuality = (quality: string) => {
    setPreferredQuality(quality);
    const nextIndex = streams.findIndex((stream) => streamQualityKey(`${stream.name} ${stream.title ?? ""}`) === quality.toLowerCase());
    if (nextIndex >= 0) setActiveIndex(nextIndex);
  };

  const advancePastFailedStream = () => {
    const rejectionKey = `${addonIndex}:${activeIndex}`;
    if (rejectedStreamIndexesRef.current.has(rejectionKey)) return;
    rejectedStreamIndexesRef.current.add(rejectionKey);

    const maxAutoSkips = 2;
    if (activeIndex + 1 < streams.length && autoSkipCountRef.current < maxAutoSkips) {
      autoSkipCountRef.current += 1;
      setActiveIndex((index) => index + 1);
      return;
    }

    setError(
      hasMoreAddons
        ? "This stream couldn't be played. Try another source below, or switch servers in Settings."
        : "This stream couldn't be played. Try again or switch servers in Settings."
    );
  };

  const tryAlternateAddon = () => {
    if (!hasMoreAddons) return;
    setError(null);
    setPlayRequested(true);
    setAddonIndex((index) => index + 1);
  };

  const retryStreams = () => {
    setError(null);
    setPlayRequested(true);
    setReloadNonce((nonce) => nonce + 1);
  };

  useEffect(() => {
    if (loading || !activeStream) return;
    const timer = window.setTimeout(() => {
      const video = videoRef.current;
      if (video && video.readyState === HTMLMediaElement.HAVE_NOTHING) {
        video.dispatchEvent(new Event("error"));
      }
    }, audioOverrideUrl ? 25_000 : 12_000);
    return () => window.clearTimeout(timer);
  }, [activeStream, loading, audioOverrideUrl]);

  const handlePlaybackError = (failedUrl?: string) => {
    if (Date.now() < ignorePlaybackErrorsUntilRef.current) return;
    if (audioOverrideUrl) {
      const expectedUrl = new URL(audioOverrideUrl, window.location.href).href;
      if (!failedUrl || failedUrl !== expectedUrl) return;
      ignorePlaybackErrorsUntilRef.current = Date.now() + 2_000;
      audioResumeTimeRef.current = videoRef.current?.currentTime || audioResumeTimeRef.current;
      setSelectedAudioIndex(0);
      setAudioOverrideUrl(null);
      return;
    }
    advancePastFailedStream();
  };

  const revealControls = useCallback(() => {
    setControlsVisible(true);
    if (controlsTimerRef.current) window.clearTimeout(controlsTimerRef.current);
    if (playing && !settingsOpen) {
      controlsTimerRef.current = window.setTimeout(() => setControlsVisible(false), 2_500);
    }
  }, [playing, settingsOpen]);

  useEffect(() => {
    revealControls();
    return () => {
      if (controlsTimerRef.current) window.clearTimeout(controlsTimerRef.current);
    };
  }, [revealControls]);

  useEffect(() => {
    if (!onPlaybackProgress || currentTime < 1) return;
    const now = Date.now();
    if (now - lastProgressReportRef.current < 5000) return;
    lastProgressReportRef.current = now;
    onPlaybackProgress(currentTime);
  }, [currentTime, onPlaybackProgress]);

  if (error && playRequested) {
    return (
      <PlayerMessage text={error}>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={retryStreams}
            className="rounded-full bg-white/15 px-4 py-2 text-sm text-white transition hover:bg-white/25"
          >
            Retry
          </button>
          {hasMoreAddons ? (
            <button
              type="button"
              onClick={tryAlternateAddon}
              className="rounded-full bg-white px-4 py-2 text-sm font-medium text-black transition hover:bg-white/90"
            >
              Try another source
            </button>
          ) : null}
        </div>
      </PlayerMessage>
    );
  }

  if (!playRequested) {
    return (
      <PlayGate
        title={title}
        type={type}
        season={season}
        episode={episode}
        posterUrl={posterUrl}
        backdropUrl={backdropUrl}
        onBack={() => router.back()}
        onPlay={() => void beginPlayback()}
      />
    );
  }

  return (
    <div
      ref={playerRef}
      onPointerMove={revealControls}
      onPointerDown={revealControls}
      onMouseLeave={() => {
        if (playing && !settingsOpen) setControlsVisible(false);
      }}
      className="group relative flex h-full min-h-0 w-full flex-col overflow-hidden bg-black"
    >
      <video
        ref={videoRef}
        autoPlay
        playsInline
        onClick={() => {
          revealControls();
          togglePlayback(videoRef.current);
        }}
        onPlay={() => {
          setPlaying(true);
          setNeedsPlaybackTap(false);
          if (!playbackStartedRef.current && watchOverlay) {
            playbackStartedRef.current = true;
            watchOverlay.notifyPlaybackStart();
          }
        }}
        onPause={() => setPlaying(false)}
        onCanPlay={(event) => {
          if (!event.currentTarget.paused) return;
          safePlay(event.currentTarget, () => setNeedsPlaybackTap(true));
        }}
        onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
        onDurationChange={(event) => {
          setDuration(event.currentTarget.duration || 0);
        }}
        onVolumeChange={(event) =>
          setMuted(event.currentTarget.muted || event.currentTarget.volume === 0)
        }
        onError={(event) => handlePlaybackError(event.currentTarget.currentSrc)}
        className="h-full w-full bg-black object-contain"
      />

      {/* Top bar */}
      {!loading && streams.length > 0 ? (
        <div
          className={`pointer-events-none absolute inset-x-0 top-0 z-20 bg-gradient-to-b from-black/75 via-black/35 to-transparent px-4 pb-10 pt-3 transition-opacity duration-300 sm:px-5 sm:pt-4 ${
            controlsVisible || settingsOpen ? "opacity-100" : "opacity-0"
          }`}
        >
          <div className="pointer-events-auto flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <button
                type="button"
                onClick={() => router.back()}
                aria-label="Go back"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white/90 ring-1 ring-white/20 transition hover:bg-white/10"
              >
                <span aria-hidden className="text-xl leading-none">
                  ‹
                </span>
              </button>
              {title ? (
                <p className="truncate text-sm font-medium text-white/95 sm:text-base">
                  {title}
                  {type === "series" && season != null && episode != null
                    ? ` · S${season}E${episode}`
                    : ""}
                </p>
              ) : null}
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <ControlButton label="Cast" onClick={() => {}} className="h-9 w-9 ring-1 ring-white/15">
                <HugeiconsIcon icon={AirplayLineIcon} size={18} />
              </ControlButton>
              <ControlButton
                label="Help"
                onClick={() => setSettingsOpen(true)}
                className="h-9 w-9 ring-1 ring-white/15"
              >
                <HugeiconsIcon icon={HelpCircleIcon} size={18} />
              </ControlButton>
            </div>
          </div>
        </div>
      ) : null}

      {needsPlaybackTap && !loading ? (
        <button
          type="button"
          aria-label="Play video"
          onClick={() => {
            const video = videoRef.current;
            if (!video) return;
            safePlay(video);
          }}
          className="absolute left-1/2 top-1/2 z-10 flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-black/65 text-white shadow-xl ring-1 ring-white/20 backdrop-blur-md transition hover:scale-105 hover:bg-black/80"
        >
          <HugeiconsIcon icon={PlayIcon} size={32} />
        </button>
      ) : null}

      {!loading && streams.length > 0 ? (
        <div
          className={`absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/90 via-black/50 to-transparent px-4 pb-4 pt-16 text-white transition-opacity duration-300 sm:px-5 ${
            controlsVisible && !settingsOpen ? "opacity-100" : "pointer-events-none opacity-0"
          }`}
        >
          <SeekBar
            currentTime={currentTime}
            duration={duration}
            onSeek={(next) => {
              if (videoRef.current) videoRef.current.currentTime = next;
              setCurrentTime(next);
            }}
          />
          <div className="flex items-center gap-1 sm:gap-2">
            <ControlButton
              label={playing ? "Pause" : "Play"}
              onClick={() => togglePlayback(videoRef.current)}
            >
              <HugeiconsIcon icon={playing ? PauseIcon : PlayIcon} size={22} />
            </ControlButton>
            <ControlButton label="Back 10 seconds" onClick={() => seekBy(videoRef.current, -10)}>
              <HugeiconsIcon icon={GoBackward10SecIcon} size={22} />
            </ControlButton>
            <ControlButton label="Forward 10 seconds" onClick={() => seekBy(videoRef.current, 10)}>
              <HugeiconsIcon icon={GoForward10SecIcon} size={22} />
            </ControlButton>
            <ControlButton
              label={muted ? "Unmute" : "Mute"}
              onClick={() => {
                if (!videoRef.current) return;
                videoRef.current.muted = !videoRef.current.muted;
              }}
            >
              <HugeiconsIcon icon={muted ? VolumeMute01Icon : VolumeHighIcon} size={22} />
            </ControlButton>
            <div className="ml-1 hidden min-w-0 flex-col sm:flex">
              <span className="truncate text-xs tabular-nums text-white/90 sm:text-sm">
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>
              {duration > 0 ? (
                <span className="truncate text-xs text-white/45">
                  {formatEndTime(currentTime, duration)}
                </span>
              ) : null}
            </div>
            <span className="ml-1 truncate text-xs tabular-nums text-white/90 sm:hidden">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
            <div className="ml-auto flex items-center gap-1 sm:gap-2">
              <ControlButton
                label="Picture in picture"
                onClick={() => void togglePictureInPicture(videoRef.current)}
              >
                <HugeiconsIcon icon={PictureInPictureOnIcon} size={20} />
              </ControlButton>
              <ControlButton label="Subtitles" onClick={() => setSettingsOpen(true)}>
                <HugeiconsIcon icon={SubtitleIcon} size={20} />
              </ControlButton>
              <ControlButton label="Settings" onClick={() => setSettingsOpen(true)}>
                <HugeiconsIcon icon={Settings01Icon} size={20} />
              </ControlButton>
              <ControlButton
                label="Fullscreen"
                onClick={() => void toggleFullscreen(playerRef.current, videoRef.current)}
              >
                <HugeiconsIcon icon={FullscreenIcon} size={20} />
              </ControlButton>
            </div>
          </div>
        </div>
      ) : null}

      {settingsOpen && activeStream ? (
        <>
          <button
            type="button"
            aria-label="Close settings"
            className="absolute inset-0 z-30 bg-black/35 backdrop-blur-[2px]"
            onClick={() => setSettingsOpen(false)}
          />
          <PlayerSettingsPanel
            preferredQuality={preferredQuality}
            selectQuality={selectQuality}
            streams={streams}
            activeIndex={activeIndex}
            audioTracks={audioTracks}
            selectedAudioIndex={selectedAudioIndex}
            selectAudioTrack={selectAudioTrack}
            video={videoRef.current}
            close={() => setSettingsOpen(false)}
            subtitleLabel={activeSubtitle(videoRef.current)}
            audioLabel={streamAudio(streamLabel)}
            hasMoreAddons={hasMoreAddons}
            onTryAlternateAddon={tryAlternateAddon}
            onTryNextStream={() => {
              if (activeIndex + 1 < streams.length) setActiveIndex((index) => index + 1);
            }}
            type={type}
          />
        </>
      ) : null}
      {loading || resolvingImdb ? (
        <div className="absolute inset-0 z-20 flex items-center justify-center overflow-hidden bg-black text-white">
          {backdropUrl ? (
            <div
              className="absolute -inset-8 scale-110 bg-cover bg-center opacity-35 blur-2xl"
              style={{ backgroundImage: `url(${JSON.stringify(backdropUrl).slice(1, -1)})` }}
              aria-hidden
            />
          ) : null}
          <div className="absolute inset-0 bg-gradient-to-b from-black/35 via-black/60 to-black/95" aria-hidden />
          <button
            type="button"
            onClick={() => router.back()}
            aria-label="Go back"
            className="absolute left-5 top-5 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-2xl text-white backdrop-blur-md transition hover:bg-white/20"
          >
            <span aria-hidden>‹</span>
          </button>
          <div className="relative z-10 flex max-w-sm flex-col items-center px-6 text-center">
            {posterUrl ? (
              <img
                src={posterUrl}
                alt=""
                className="mb-5 h-48 w-32 rounded-xl object-cover shadow-2xl ring-1 ring-white/15 sm:h-56 sm:w-[9.35rem]"
              />
            ) : null}
            {title ? <h2 className="text-xl font-semibold sm:text-2xl">{title}</h2> : null}
            <p className="mt-6 text-sm text-white/45">Finding streams…</p>
            <div className="mt-4 flex items-center gap-2" aria-hidden>
              {[0, 1, 2].map((dot) => (
                <span
                  key={dot}
                  className="h-2.5 w-2.5 animate-bounce rounded-full bg-white/70"
                  style={{ animationDelay: `${dot * 140}ms` }}
                />
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function PlayGate({
  title,
  type,
  season,
  episode,
  posterUrl,
  backdropUrl,
  onBack,
  onPlay,
}: {
  title: string;
  type: "movie" | "series";
  season?: number;
  episode?: number;
  posterUrl?: string | null;
  backdropUrl?: string | null;
  onBack: () => void;
  onPlay: () => void;
}) {
  return (
    <div className="relative flex h-full min-h-0 w-full items-center justify-center overflow-hidden bg-black text-white">
      {backdropUrl ? (
        <div
          className="absolute -inset-8 scale-110 bg-cover bg-center opacity-35 blur-2xl"
          style={{ backgroundImage: `url(${JSON.stringify(backdropUrl).slice(1, -1)})` }}
          aria-hidden
        />
      ) : null}
      <div className="absolute inset-0 bg-gradient-to-b from-black/35 via-black/60 to-black/95" aria-hidden />
      <button
        type="button"
        onClick={onBack}
        aria-label="Go back"
        className="absolute left-5 top-5 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-2xl text-white backdrop-blur-md transition hover:bg-white/20"
      >
        <span aria-hidden>‹</span>
      </button>
      <div className="relative z-10 flex max-w-sm flex-col items-center px-6 text-center">
        {posterUrl ? (
          <img
            src={posterUrl}
            alt=""
            className="mb-5 h-48 w-32 rounded-xl object-cover shadow-2xl ring-1 ring-white/15 sm:h-56 sm:w-[9.35rem]"
          />
        ) : null}
        {title ? <h2 className="text-xl font-semibold sm:text-2xl">{title}</h2> : null}
        {type === "series" && season != null && episode != null ? (
          <p className="mt-2 text-sm text-white/45">
            Season {season} · Episode {episode}
          </p>
        ) : null}
        <button
          type="button"
          onClick={onPlay}
          className="mt-8 flex h-14 w-14 items-center justify-center rounded-full bg-white text-black shadow-xl transition hover:scale-105 hover:bg-white/90"
          aria-label="Play"
        >
          <HugeiconsIcon icon={PlayIcon} size={28} />
        </button>
      </div>
    </div>
  );
}

function SeekBar({
  currentTime,
  duration,
  onSeek,
}: {
  currentTime: number;
  duration: number;
  onSeek: (seconds: number) => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const pct =
    duration > 0 ? Math.min(100, Math.max(0, (currentTime / duration) * 100)) : 0;

  const seekFromClientX = (clientX: number) => {
    const track = trackRef.current;
    if (!track || duration <= 0) return;
    const rect = track.getBoundingClientRect();
    if (rect.width <= 0) return;
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    onSeek(ratio * duration);
  };

  return (
    <div
      ref={trackRef}
      role="slider"
      aria-label="Seek"
      aria-valuemin={0}
      aria-valuemax={Math.floor(duration)}
      aria-valuenow={Math.floor(currentTime)}
      tabIndex={0}
      className="group/seek relative mb-3 h-5 cursor-pointer touch-none"
      onPointerDown={(event) => {
        event.stopPropagation();
        seekFromClientX(event.clientX);
        const onMove = (moveEvent: PointerEvent) => seekFromClientX(moveEvent.clientX);
        const onUp = () => {
          window.removeEventListener("pointermove", onMove);
          window.removeEventListener("pointerup", onUp);
        };
        window.addEventListener("pointermove", onMove);
        window.addEventListener("pointerup", onUp);
      }}
      onKeyDown={(event) => {
        if (duration <= 0) return;
        const step = event.shiftKey ? 30 : 10;
        if (event.key === "ArrowRight") onSeek(Math.min(duration, currentTime + step));
        if (event.key === "ArrowLeft") onSeek(Math.max(0, currentTime - step));
      }}
    >
      <div className="absolute inset-x-0 top-1/2 h-[3px] -translate-y-1/2 rounded-full bg-white/20 transition-all group-hover/seek:h-1" />
      <div
        className="absolute top-1/2 h-[3px] -translate-y-1/2 rounded-full bg-white transition-all group-hover/seek:h-1"
        style={{ width: `${pct}%` }}
      />
      <div
        className="absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white opacity-0 shadow transition group-hover/seek:opacity-100"
        style={{ left: `${pct}%` }}
      />
    </div>
  );
}

function SettingsSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="border-t border-white/10 pt-4 first:border-t-0 first:pt-0">
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-white/40">
        {title}
      </h3>
      {children}
    </section>
  );
}

function SettingsRow({
  label,
  value,
  onClick,
  icon,
}: {
  label: string;
  value?: string;
  onClick?: () => void;
  icon?: Parameters<typeof HugeiconsIcon>[0]["icon"];
}) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={`flex w-full items-center justify-between gap-3 rounded-xl px-1 py-2.5 text-left transition ${
        onClick ? "hover:bg-white/[0.05]" : ""
      }`}
    >
      <div className="flex min-w-0 items-center gap-2.5">
        {icon ? <HugeiconsIcon icon={icon} size={18} className="shrink-0 text-white/55" /> : null}
        <span className="text-sm text-white/85">{label}</span>
      </div>
      {value ? (
        <span className="flex shrink-0 items-center gap-1 text-sm text-white/45">
          {value}
          {onClick ? <HugeiconsIcon icon={ArrowRight01Icon} size={16} /> : null}
        </span>
      ) : null}
    </Tag>
  );
}

function PlayerSettingsPanel({
  preferredQuality,
  selectQuality,
  streams,
  activeIndex,
  audioTracks,
  selectedAudioIndex,
  selectAudioTrack,
  video,
  close,
  subtitleLabel,
  audioLabel,
  hasMoreAddons,
  onTryAlternateAddon,
  onTryNextStream,
  type,
}: {
  preferredQuality: string;
  selectQuality: (quality: string) => void;
  streams: PlayableStream[];
  activeIndex: number;
  audioTracks: AudioTrack[];
  selectedAudioIndex: number;
  selectAudioTrack: (index: number) => void;
  video: HTMLVideoElement | null;
  close: () => void;
  subtitleLabel: string;
  audioLabel: string;
  hasMoreAddons: boolean;
  onTryAlternateAddon: () => void;
  onTryNextStream: () => void;
  type: "movie" | "series";
}) {
  const [autoplayNext, setAutoplayNext] = useState(false);
  const qualities = ["480p", "720p", "1080p", "2160p"];
  const speeds = [0.5, 0.75, 1, 1.25, 1.5, 2];
  const activeStream = streams[activeIndex];

  useEffect(() => {
    try {
      const saved = localStorage.getItem("teavie-autoplay-next");
      if (saved != null) setAutoplayNext(saved === "1");
    } catch {
      /* ignore */
    }
  }, []);

  return (
    <aside className="absolute right-0 top-0 z-40 flex h-full w-full max-w-[min(100%,380px)] flex-col border-l border-white/10 bg-[#141414]/92 shadow-[-24px_0_80px_rgba(0,0,0,0.45)] backdrop-blur-2xl">
      <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
        <h2 className="text-base font-medium text-white">Settings</h2>
        <button
          type="button"
          aria-label="Close settings"
          onClick={close}
          className="flex h-8 w-8 items-center justify-center rounded-full text-white/70 transition hover:bg-white/10 hover:text-white"
        >
          <HugeiconsIcon icon={Cancel01Icon} size={20} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4">
        <SettingsSection title="Picture">
          <div className="mb-4">
            <p className="mb-2 text-sm text-white/55">Quality</p>
            <div className="flex flex-wrap gap-2">
              {qualities.map((quality) => (
                <button
                  key={quality}
                  type="button"
                  onClick={() => selectQuality(quality)}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                    preferredQuality === quality
                      ? "bg-white text-black"
                      : "bg-white/10 text-white/70 hover:bg-white/15"
                  }`}
                >
                  {quality.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-2 text-sm text-white/55">Speed</p>
            <div className="flex flex-wrap gap-2">
              {speeds.map((speed) => (
                <button
                  key={speed}
                  type="button"
                  onClick={() => {
                    if (video) video.playbackRate = speed;
                  }}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                    (video?.playbackRate ?? 1) === speed
                      ? "bg-white text-black"
                      : "bg-white/10 text-white/70 hover:bg-white/15"
                  }`}
                >
                  {speed}x
                </button>
              ))}
            </div>
          </div>
        </SettingsSection>

        <SettingsSection title="Audio and subtitles">
          <SettingsRow label="Subtitles" value={subtitleLabel} icon={SubtitleIcon} />
          {audioTracks.length > 1 ? (
            audioTracks.map((track) => (
              <SettingsRow
                key={track.audioIndex}
                label={audioTrackLabel(track)}
                value={selectedAudioIndex === track.audioIndex ? "Active" : undefined}
                onClick={() => selectAudioTrack(track.audioIndex)}
                icon={VolumeHighIcon}
              />
            ))
          ) : (
            <SettingsRow label="Audio" value={audioLabel} icon={VolumeHighIcon} />
          )}
        </SettingsSection>

        <SettingsSection title="Source">
          <SettingsRow
            label="Server"
            value={activeStream?.name ?? `Source ${activeIndex + 1}`}
            icon={ComputerIcon}
          />
          {activeIndex + 1 < streams.length ? (
            <SettingsRow label="Try another source" onClick={onTryNextStream} icon={ComputerIcon} />
          ) : null}
          {hasMoreAddons ? (
            <SettingsRow label="Try alternate provider" onClick={onTryAlternateAddon} icon={ComputerIcon} />
          ) : null}
        </SettingsSection>

        {type === "series" ? (
          <SettingsSection title="Playback">
            <div className="flex items-center justify-between gap-3 py-2">
              <div>
                <p className="text-sm text-white/85">Autoplay next episode</p>
                <p className="text-xs text-white/40">Turn this off before sleeping</p>
              </div>
              <Switch
                size="sm"
                isSelected={autoplayNext}
                onValueChange={(enabled) => {
                  setAutoplayNext(enabled);
                  try {
                    localStorage.setItem("teavie-autoplay-next", enabled ? "1" : "0");
                  } catch {
                    /* ignore */
                  }
                }}
              />
            </div>
          </SettingsSection>
        ) : null}
      </div>

      <div className="border-t border-white/10 px-5 py-4">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-white/45">
          <button type="button" className="transition hover:text-white/75">
            Cast
          </button>
          <button type="button" className="transition hover:text-white/75">
            Help
          </button>
        </div>
      </div>
    </aside>
  );
}

function streamQualityKey(label: string) {
  if (/\b(?:2160p?|4k|uhd)\b/i.test(label)) return "2160p";
  if (/\b1080[pi]?\b/i.test(label)) return "1080p";
  if (/\b720[pi]?\b/i.test(label)) return "720p";
  if (/\b(?:576|540|480)[pi]?\b/i.test(label)) return "480p";
  return "auto";
}

function streamAudio(label: string) {
  const codec = label.match(/\b(AAC|Atmos|True[ ._-]?HD|E[ ._-]?AC[ ._-]?3|DDP|DTS(?:[ ._-]?HD)?|AC[ ._-]?3|MP3)(?:[ ._-]?(2\.0|5\.1|7\.1))?/i);
  return codec ? [codec[1], codec[2]].filter(Boolean).join(" ").toUpperCase() : "Unknown";
}

function audioTrackLabel(track: AudioTrack) {
  let language = track.language.toUpperCase();
  try {
    if (track.language !== "und") language = new Intl.DisplayNames(["en"], { type: "language" }).of(track.language) || language;
  } catch {}
  const channels = track.channels ? (track.channels === 2 ? "Stereo" : `${track.channels}ch`) : null;
  return [track.title || language, track.codec, channels].filter(Boolean).join(" · ");
}

function activeSubtitle(video: HTMLVideoElement | null) {
  if (!video) return "None";
  const track = Array.from(video.textTracks).find((item) => item.mode === "showing");
  return track?.label || track?.language || "None";
}

function ControlButton({
  label,
  onClick,
  children,
  className = "",
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white transition hover:bg-white/15 ${className}`}
    >
      {children}
    </button>
  );
}

function togglePlayback(video: HTMLVideoElement | null) {
  if (!video) return;
  if (video.paused) safePlay(video);
  else video.pause();
}

function safePlay(video: HTMLVideoElement, onBlocked?: () => void) {
  video.play().catch((error: unknown) => {
    if (
      error instanceof DOMException &&
      (error.name === "AbortError" || error.name === "NotAllowedError")
    ) {
      if (error.name === "NotAllowedError") onBlocked?.();
      return;
    }
    console.error("Video playback failed", error);
  });
}

function seekBy(video: HTMLVideoElement | null, seconds: number) {
  if (!video) return;
  video.currentTime = Math.max(0, Math.min(video.duration || Infinity, video.currentTime + seconds));
}

async function togglePictureInPicture(video: HTMLVideoElement | null) {
  if (!video) return;
  try {
    if (document.pictureInPictureElement) {
      await document.exitPictureInPicture();
      return;
    }
    if (typeof video.requestPictureInPicture === "function") {
      await video.requestPictureInPicture();
      return;
    }
    const safariVideo = video as HTMLVideoElement & {
      webkitPresentationMode?: string;
      webkitSupportsPresentationMode?: (mode: string) => boolean;
      webkitSetPresentationMode?: (mode: string) => void;
    };
    if (safariVideo.webkitSupportsPresentationMode?.("picture-in-picture")) {
      safariVideo.webkitSetPresentationMode?.(
        safariVideo.webkitPresentationMode === "picture-in-picture" ? "inline" : "picture-in-picture"
      );
    }
  } catch (error) {
    console.warn("Picture-in-picture is unavailable", error);
  }
}

async function toggleFullscreen(container: HTMLDivElement | null, video: HTMLVideoElement | null) {
  const safariDocument = document as Document & {
    webkitFullscreenElement?: Element | null;
    webkitExitFullscreen?: () => void;
  };
  try {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
      return;
    }
    if (safariDocument.webkitFullscreenElement) {
      safariDocument.webkitExitFullscreen?.();
      return;
    }
    if (container?.requestFullscreen) {
      await container.requestFullscreen();
      return;
    }
    const safariVideo = video as (HTMLVideoElement & { webkitEnterFullscreen?: () => void }) | null;
    safariVideo?.webkitEnterFullscreen?.();
  } catch (error) {
    console.warn("Fullscreen is unavailable", error);
  }
}

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const total = Math.floor(seconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const remainder = total % 60;
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`
    : `${minutes}:${String(remainder).padStart(2, "0")}`;
}

function formatEndTime(currentTime: number, duration: number) {
  if (!Number.isFinite(duration) || duration <= 0) return "";
  const remainingMs = Math.max(0, duration - currentTime) * 1000;
  const end = new Date(Date.now() + remainingMs);
  return `Ends at ${end.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
}

function PlayerMessage({
  text,
  children,
}: {
  text: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex h-full min-h-0 w-full flex-col items-center justify-center rounded-lg bg-black px-6 text-center text-sm text-white/70 ring-1 ring-white/10">
      <p>{text}</p>
      {children}
    </div>
  );
}

function canDecode(mimeType: string): boolean {
  if (window.MediaSource?.isTypeSupported?.(mimeType)) return true;
  return document.createElement("video").canPlayType(mimeType) === "probably";
}

/**
 * Ask the browser what it can actually decode so stream selection can drop
 * releases that would play as silent video. Chrome and Firefox ship no Dolby
 * Digital decoder, which is why most 1080p WEB-DL releases have no sound there.
 */
function detectMediaCapabilities(): ClientMediaCapabilities {
  if (typeof window === "undefined") return { ac3: false, preferSafari: false };
  const userAgent = navigator.userAgent;
  return {
    ac3:
      canDecode('audio/mp4; codecs="ac-3"') || canDecode('audio/mp4; codecs="ec-3"'),
    preferSafari:
      /iphone|ipad|ipod/i.test(userAgent) ||
      (/safari/i.test(userAgent) && !/chrome|chromium|crios|android|edg|opr/i.test(userAgent)),
  };
}

function normalizeImdbId(raw: string): string | null {
  const trimmed = String(raw ?? "").trim();
  if (!trimmed) return null;
  const fromUrl = trimmed.match(/imdb\.com\/title\/(tt\d+)/i)?.[1];
  if (fromUrl) return fromUrl.toLowerCase();
  if (/^tt\d+$/i.test(trimmed)) return trimmed.toLowerCase();
  if (/^\d{5,}$/.test(trimmed)) return `tt${trimmed}`;
  return null;
}
