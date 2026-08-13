"use client";

import Hls from "hls.js";
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button, ButtonGroup, Card, CardBody, Modal, ModalContent, Select, SelectItem, Slider, Switch } from "@heroui/react";
import {
  ArrowRight01Icon,
  Cancel01Icon,
  ComputerIcon,
  FullscreenIcon,
  GoBackward10SecIcon,
  GoForward10SecIcon,
  PauseIcon,
  PictureInPictureOnIcon,
  PlayIcon,
  Settings01Icon,
  SlidersHorizontalIcon,
  SubtitleIcon,
  UserGroupIcon,
  VolumeHighIcon,
  VolumeMute01Icon,
} from "@hugeicons/core-free-icons";
import type { PlayableStream } from "@/lib/stremio/types";
import WatchPlayerBackButton from "@/components/ui/watchPlayerBackButton";
import { useWatchPartyNav } from "@/contexts/watchPartyNavContext";

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
  const { openTeaParty } = useWatchPartyNav();
  const [resolvedImdbId, setResolvedImdbId] = useState<string | null>(() =>
    imdbId ? normalizeImdbId(imdbId) : null
  );
  const [resolvingImdb, setResolvingImdb] = useState(() => !imdbId);
  const effectiveImdbId = resolvedImdbId;
  const playerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const fallbackRequestedRef = useRef(false);
  const rejectedStreamIndexesRef = useRef(new Set<string>());
  const audioResumeTimeRef = useRef(0);
  const ignorePlaybackErrorsUntilRef = useRef(0);
  const controlsTimerRef = useRef<number | null>(null);
  const lastProgressReportRef = useRef(0);
  const [streams, setStreams] = useState<PlayableStream[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [loading, setLoading] = useState(true);
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

  useEffect(() => {
    if (imdbId) {
      setResolvedImdbId(normalizeImdbId(imdbId));
      setResolvingImdb(false);
      return;
    }
    const key = String(catalogKey ?? "").trim();
    if (!/^\d+$/.test(key)) {
      setResolvedImdbId(null);
      setResolvingImdb(false);
      return;
    }
    let cancelled = false;
    setResolvingImdb(true);
    const endpoint = type === "series" ? "/api/tv/resolve" : "/api/movie/resolve";
    void fetch(`${endpoint}?id=${encodeURIComponent(key)}`)
      .then(async (response) => (response.ok ? response.json() : null))
      .then((body) => {
        if (cancelled) return;
        const next =
          typeof body?.imdbId === "string" ? normalizeImdbId(body.imdbId) : null;
        setResolvedImdbId(next);
      })
      .catch(() => {
        if (!cancelled) setResolvedImdbId(null);
      })
      .finally(() => {
        if (!cancelled) setResolvingImdb(false);
      });
    return () => {
      cancelled = true;
    };
  }, [imdbId, catalogKey, type]);

  const query = useMemo(() => {
    const q = new URLSearchParams({ type, id: effectiveImdbId ?? "" });
    if (type === "series") {
      q.set("season", String(season ?? ""));
      q.set("episode", String(episode ?? ""));
    }
    return q.toString();
  }, [type, effectiveImdbId, season, episode]);

  useEffect(() => {
    if (!effectiveImdbId) return;
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    setStreams([]);
    setActiveIndex(0);
    fallbackRequestedRef.current = false;
    rejectedStreamIndexesRef.current.clear();
    fetch(`/api/streams?${query}`, { signal: controller.signal })
      .then(async (response) => {
        const raw = await response.text();
        let body: Record<string, unknown> = {};
        if (raw.trim()) {
          try {
            body = JSON.parse(raw) as Record<string, unknown>;
          } catch {
            throw new Error(
              response.ok
                ? "The stream service returned an invalid response."
                : `The stream service failed (HTTP ${response.status}).`
            );
          }
        }
        if (!response.ok) {
          throw new Error(
            typeof body.error === "string" ? body.error : "Could not load streams"
          );
        }
        if (!raw.trim()) throw new Error("The stream service returned an empty response.");
        return body;
      })
      .then((body) => {
        const next = Array.isArray(body.streams) ? body.streams : [];
        setStreams(next);
        if (!next.length) {
          const providerErrors = Array.isArray(body.errors)
            ? body.errors
                .map((entry) =>
                  entry && typeof entry === "object" && "message" in entry
                    ? String((entry as { message?: unknown }).message ?? "")
                    : ""
                )
                .filter(Boolean)
            : [];
          const providerError = providerErrors[0] ?? null;
          if (providerError) {
            const allTimedOut = providerErrors.every((message) =>
              /took too long|timeout/i.test(message)
            );
            setError(
              allTimedOut
                ? "Stream addons timed out. They may be slow or overloaded — try again in a moment."
                : `The configured addon could not return streams: ${providerError}`
            );
          } else if (Number(body.unsupported) > 0) {
            setError(
              `The addon returned ${body.unsupported} torrent or non-web stream${body.unsupported === 1 ? "" : "s"}. Configure it with a direct-link provider to use this browser player.`
            );
          } else {
            const detail =
              providerErrors.length > 0
                ? providerErrors.slice(0, 3).join(" · ")
                : null;
            setError(
              detail
                ? `No playable streams for this IMDb id. ${detail}`
                : "No streams found for this IMDb id. Check the id, season, and episode, then try again."
            );
          }
        }
      })
      .catch((reason) => {
        if (reason instanceof DOMException && reason.name === "AbortError") return;
        if (reason?.name !== "AbortError") setError(reason?.message || "Could not load streams");
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [query, effectiveImdbId]);

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
    const supportsNativeHls = Boolean(
      video.canPlayType("application/vnd.apple.mpegurl") ||
        video.canPlayType("application/x-mpegURL")
    );
    if (isHls && !supportsNativeHls && Hls.isSupported()) {
      hls = new Hls();
      hls.loadSource(playbackUrl);
      hls.attachMedia(video);
    } else {
      video.src = playbackUrl;
    }
    return () => {
      video.removeEventListener("loadedmetadata", resume);
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
    const rejectionKey = `${fallbackRequestedRef.current ? "fallback" : "primary"}:${activeIndex}`;
    if (rejectedStreamIndexesRef.current.has(rejectionKey)) return;
    rejectedStreamIndexesRef.current.add(rejectionKey);

    if (activeIndex + 1 < streams.length) {
      setActiveIndex((index) => index + 1);
      return;
    }
    if (fallbackRequestedRef.current) {
      setError("No compatible English stream could be played in this browser.");
      return;
    }
    fallbackRequestedRef.current = true;
    setLoading(true);
    fetch(`/api/streams?${query}&fallback=1`)
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || "Fallback provider failed");
        const next = Array.isArray(body.streams) ? body.streams : [];
        if (!next.length) throw new Error("The fallback provider returned no compatible streams.");
        rejectedStreamIndexesRef.current.clear();
        const fallbackStartIndex = streams.length;
        setStreams((current) => [...current, ...next]);
        setActiveIndex(fallbackStartIndex);
      })
      .catch((reason) => setError(reason?.message || "No compatible stream was found."))
      .finally(() => setLoading(false));
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

  if (!effectiveImdbId && !resolvingImdb) {
    return (
      <PlayerMessage text="No playback source available for this title." />
    );
  }
  if (error) return <PlayerMessage text={error} />;

  return (
    <div ref={playerRef} onPointerMove={revealControls} onPointerDown={revealControls} onMouseLeave={() => { if (playing && !settingsOpen) setControlsVisible(false); }} className="group relative flex h-full min-h-0 w-full flex-col overflow-hidden rounded-lg bg-black ring-1 ring-white/10">
      <WatchPlayerBackButton />
      <video
        ref={videoRef}
        autoPlay
        playsInline
        onClick={() => { revealControls(); togglePlayback(videoRef.current); }}
        onPlay={() => { setPlaying(true); setNeedsPlaybackTap(false); }}
        onPause={() => setPlaying(false)}
        onCanPlay={(event) => {
          if (!event.currentTarget.paused) return;
          safePlay(event.currentTarget, () => setNeedsPlaybackTap(true));
        }}
        onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
        onDurationChange={(event) => {
          const nextDuration = event.currentTarget.duration || 0;
          setDuration(nextDuration);
          if (nextDuration > 0 && nextDuration <= 35) {
            advancePastFailedStream();
          }
        }}
        onVolumeChange={(event) => setMuted(event.currentTarget.muted || event.currentTarget.volume === 0)}
        onError={(event) => handlePlaybackError(event.currentTarget.currentSrc)}
        className="h-full w-full bg-black object-contain"
      />
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
        <div className={`absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/90 via-black/55 to-transparent px-4 pb-4 pt-14 text-white transition-opacity duration-300 sm:px-6 ${controlsVisible ? "opacity-100" : "pointer-events-none opacity-0"}`}>
          <input
            aria-label="Seek"
            type="range"
            min={0}
            max={duration || 0}
            step={0.1}
            value={Math.min(currentTime, duration || 0)}
            onChange={(event) => {
              const next = Number(event.target.value);
              if (videoRef.current) videoRef.current.currentTime = next;
              setCurrentTime(next);
            }}
            className="mb-3 h-1 w-full cursor-pointer accent-white"
          />
          <div className="flex items-center gap-2 sm:gap-3">
            <ControlButton label={playing ? "Pause" : "Play"} onClick={() => togglePlayback(videoRef.current)}>
              <HugeiconsIcon icon={playing ? PauseIcon : PlayIcon} size={24} />
            </ControlButton>
            <ControlButton label="Back 10 seconds" onClick={() => seekBy(videoRef.current, -10)}>
              <HugeiconsIcon icon={GoBackward10SecIcon} size={24} />
            </ControlButton>
            <ControlButton label="Forward 10 seconds" onClick={() => seekBy(videoRef.current, 10)}>
              <HugeiconsIcon icon={GoForward10SecIcon} size={24} />
            </ControlButton>
            <ControlButton
              label={muted ? "Unmute" : "Mute"}
              onClick={() => {
                if (!videoRef.current) return;
                videoRef.current.muted = !videoRef.current.muted;
              }}
            >
              <HugeiconsIcon icon={muted ? VolumeMute01Icon : VolumeHighIcon} size={24} />
            </ControlButton>
            <span className="ml-1 whitespace-nowrap text-sm tabular-nums text-white/90">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
            <div className="ml-auto flex items-center gap-2 sm:gap-3">
              <ControlButton
                label="Picture in picture"
                onClick={() => void togglePictureInPicture(videoRef.current)}
              >
                <HugeiconsIcon icon={PictureInPictureOnIcon} size={23} />
              </ControlButton>
              <ControlButton label="Playback settings" onClick={() => setSettingsOpen(true)}>
                <HugeiconsIcon icon={Settings01Icon} size={24} />
              </ControlButton>
              <ControlButton label="Toggle fullscreen" onClick={() => void toggleFullscreen(playerRef.current, videoRef.current)}>
                <HugeiconsIcon icon={FullscreenIcon} size={24} />
              </ControlButton>
            </div>
          </div>
        </div>
      ) : null}
      <Modal
        isOpen={settingsOpen}
        onOpenChange={setSettingsOpen}
        size="5xl"
        placement="center"
        scrollBehavior="inside"
        backdrop="blur"
        hideCloseButton
        classNames={{
          base: "bg-transparent shadow-none",
          backdrop: "bg-black/45 backdrop-blur-md",
        }}
      >
        <ModalContent>
          {activeStream ? (
            <PlayerSettingsMenu
              preferredQuality={preferredQuality}
              selectQuality={selectQuality}
              audioTracks={audioTracks}
              selectedAudioIndex={selectedAudioIndex}
              selectAudioTrack={selectAudioTrack}
              video={videoRef.current}
              close={() => setSettingsOpen(false)}
              openWatchParty={openTeaParty}
              subtitleLabel={activeSubtitle(videoRef.current)}
              audioLabel={streamAudio(streamLabel)}
            />
          ) : null}
        </ModalContent>
      </Modal>
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

function SettingTile({ icon, label, value }: { icon: Parameters<typeof HugeiconsIcon>[0]["icon"]; label: string; value: string }) {
  return (
    <Card className="min-w-0 border border-white/10 bg-white/[0.055] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-md">
      <CardBody className="p-4 text-sm">
        <div className="flex items-center gap-2 font-normal"><HugeiconsIcon icon={icon} size={19} className="text-white/65" />{label}</div>
        <p className="mt-1 truncate pl-7 text-sm font-normal text-white/45">{value}</p>
      </CardBody>
    </Card>
  );
}

function PlayerSettingsMenu({ preferredQuality, selectQuality, audioTracks, selectedAudioIndex, selectAudioTrack, video, close, openWatchParty, subtitleLabel, audioLabel }: {
  preferredQuality: string;
  selectQuality: (quality: string) => void;
  audioTracks: AudioTrack[];
  selectedAudioIndex: number;
  selectAudioTrack: (index: number) => void;
  video: HTMLVideoElement | null;
  close: () => void;
  openWatchParty: () => void;
  subtitleLabel: string;
  audioLabel: string;
}) {
  const [view, setView] = useState<"main" | "playback" | "color">("main");
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [saturation, setSaturation] = useState(100);
  const [hue, setHue] = useState(0);
  const [colorPreset, setColorPreset] = useState("Default");
  const [volumeBoost, setVolumeBoost] = useState(false);

  useEffect(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem("teavie-player-color") || "null") as { brightness?: number; contrast?: number; saturation?: number; hue?: number; preset?: string } | null;
      if (!saved) return;
      setBrightness(saved.brightness ?? 100);
      setContrast(saved.contrast ?? 100);
      setSaturation(saved.saturation ?? 100);
      setHue(saved.hue ?? 0);
      setColorPreset(saved.preset ?? "Default");
    } catch {}
  }, []);

  useEffect(() => {
    if (video) video.style.filter = `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%) hue-rotate(${hue}deg)`;
    sessionStorage.setItem("teavie-player-color", JSON.stringify({ brightness, contrast, saturation, hue, preset: colorPreset }));
  }, [video, brightness, contrast, saturation, hue, colorPreset]);

  const applyPreset = (preset: string) => {
    const values: Record<string, [number, number, number, number]> = {
      Cinematic: [95, 110, 90, 0],
      Vivid: [105, 115, 135, 0],
      Warm: [103, 105, 112, -8],
      Cool: [100, 105, 105, 8],
      Noir: [98, 120, 0, 0],
      HDR: [115, 118, 112, 0],
      Default: [100, 100, 100, 0],
    };
    const [nextBrightness, nextContrast, nextSaturation, nextHue] = values[preset];
    setColorPreset(preset);
    setBrightness(nextBrightness);
    setContrast(nextContrast);
    setSaturation(nextSaturation);
    setHue(nextHue);
  };

  return (
    <div className="max-h-[82vh] w-full overflow-y-auto rounded-3xl border border-white/15 bg-background/65 p-6 text-sm font-normal text-white shadow-[0_24px_100px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(255,255,255,0.12)] backdrop-blur-2xl backdrop-saturate-150 sm:p-8">
      <div className="mb-5 flex items-center justify-between">
        {view !== "main" ? (
          <Button size="sm" variant="light" onPress={() => setView(view === "color" ? "playback" : "main")} startContent={<HugeiconsIcon icon={ArrowRight01Icon} size={18} className="rotate-180" />} className="text-sm font-normal text-white">{view === "color" ? "Advanced color" : "Playback"}</Button>
        ) : <h2 className="text-sm font-normal">Settings</h2>}
        <Button isIconOnly size="sm" variant="light" aria-label="Close settings" onPress={close} className="text-white"><HugeiconsIcon icon={Cancel01Icon} size={23} /></Button>
      </div>
      {view === "main" ? <>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Card className="min-w-0 border border-white/10 bg-white/[0.055] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-md">
            <CardBody className="p-3">
              <Select
                label="Quality"
                aria-label="Preferred quality"
                size="sm"
                selectedKeys={new Set([preferredQuality])}
                onSelectionChange={(keys) => {
                  const key = Array.from(keys)[0];
                  if (key != null) selectQuality(String(key));
                }}
                startContent={<HugeiconsIcon icon={ComputerIcon} size={18} className="text-white/65" />}
                classNames={{ label: "text-sm font-normal text-white", value: "text-sm font-normal text-white/55", trigger: "min-h-14 bg-transparent shadow-none", popoverContent: "bg-background/85 backdrop-blur-2xl" }}
              >
                {["2160P", "1080P", "720P", "480P"].map((quality) => <SelectItem key={quality.toLowerCase()}>{quality}</SelectItem>)}
              </Select>
            </CardBody>
          </Card>
          <SettingTile icon={SubtitleIcon} label="Subtitles" value={subtitleLabel} />
          {audioTracks.length > 1 ? <Card className="min-w-0 border border-white/10 bg-white/[0.055] backdrop-blur-md"><CardBody className="p-3"><Select label="Audio" size="sm" selectedKeys={new Set([String(selectedAudioIndex)])} onSelectionChange={(keys) => { const key = Array.from(keys)[0]; if (key != null) selectAudioTrack(Number(key)); }} startContent={<HugeiconsIcon icon={VolumeHighIcon} size={18} className="text-white/65" />} classNames={{ label: "text-sm font-normal text-white", value: "text-sm font-normal text-white/55", trigger: "min-h-14 bg-transparent shadow-none", popoverContent: "bg-background/85 backdrop-blur-2xl" }}>{audioTracks.map((track) => <SelectItem key={String(track.audioIndex)} textValue={audioTrackLabel(track)}>{audioTrackLabel(track)}</SelectItem>)}</Select></CardBody></Card> : <SettingTile icon={VolumeHighIcon} label="Audio" value={audioLabel} />}
        </div>
        <div className="mt-5 space-y-1">
          <Button fullWidth variant="light" onPress={() => setView("playback")} startContent={<HugeiconsIcon icon={SlidersHorizontalIcon} size={20} className="text-white/60" />} endContent={<HugeiconsIcon icon={ArrowRight01Icon} size={18} className="text-white/50" />} className="h-14 justify-start text-sm font-normal text-white [&>span:nth-child(2)]:flex-1 [&>span:nth-child(2)]:text-left">Playback</Button>
          <Button fullWidth variant="light" onPress={() => { close(); openWatchParty(); }} startContent={<HugeiconsIcon icon={UserGroupIcon} size={20} className="text-white/60" />} endContent={<HugeiconsIcon icon={ArrowRight01Icon} size={18} className="text-white/50" />} className="h-14 justify-start text-sm font-normal text-white [&>span:nth-child(2)]:flex-1 [&>span:nth-child(2)]:text-left">Watch Party</Button>
        </div>
      </> : view === "playback" ? <div className="space-y-6">
        <ButtonGroup fullWidth variant="flat" className="rounded-xl bg-white/[0.07] p-1">{[0.25, 0.5, 1, 1.5, 2].map((speed) => <Button key={speed} size="sm" onPress={() => { if (video) video.playbackRate = speed; }} className={`min-w-0 text-sm font-normal text-white ${video?.playbackRate === speed ? "bg-white/20" : "bg-transparent"}`}>{speed}×</Button>)}</ButtonGroup>
        <Slider label="Brightness" minValue={50} maxValue={150} step={1} value={brightness} onChange={(next) => { const value = Array.isArray(next) ? next[0] : next; setBrightness(value); if (video) video.style.filter = `brightness(${value}%)`; }} showTooltip size="sm" color="foreground" classNames={{ label: "text-sm font-normal text-white", value: "text-sm font-normal text-white" }} getValue={(value) => `${value}%`} />
        <div className="flex items-center justify-between text-sm font-normal"><span>Volume Boost</span><Switch size="sm" isSelected={volumeBoost} onValueChange={(enabled) => { setVolumeBoost(enabled); if (video) video.volume = 1; }} /></div>
        <Button fullWidth variant="light" onPress={() => setView("color")} endContent={<HugeiconsIcon icon={ArrowRight01Icon} size={18} className="text-white/50" />} className="h-12 justify-start text-sm font-normal text-white [&>span:nth-child(2)]:flex-1 [&>span:nth-child(2)]:text-left">Advanced color</Button>
      </div> : <div className="space-y-6">
        <div className="flex flex-wrap gap-2">
          {["Cinematic", "Vivid", "Warm", "Cool", "Noir", "HDR", "Default"].map((preset) => (
            <Button key={preset} size="sm" radius="full" variant={colorPreset === preset ? "solid" : "flat"} color={colorPreset === preset ? "default" : undefined} onPress={() => applyPreset(preset)} className={`text-sm font-normal ${colorPreset === preset ? "bg-white text-black" : "bg-white/[0.07] text-white/65"}`}>{preset}</Button>
          ))}
        </div>
        <ColorSlider label="Brightness" value={brightness} min={50} max={150} suffix="%" onChange={(value) => { setColorPreset("Custom"); setBrightness(value); }} />
        <ColorSlider label="Contrast" value={contrast} min={50} max={150} suffix="%" onChange={(value) => { setColorPreset("Custom"); setContrast(value); }} />
        <ColorSlider label="Saturation" value={saturation} min={0} max={200} suffix="%" onChange={(value) => { setColorPreset("Custom"); setSaturation(value); }} />
        <ColorSlider label="Hue" value={hue} min={-180} max={180} suffix="°" onChange={(value) => { setColorPreset("Custom"); setHue(value); }} />
        <Button fullWidth variant="light" onPress={() => applyPreset("Default")} className="text-sm font-normal text-white/45">Reset all</Button>
        <p className="text-xs font-normal leading-relaxed text-white/35">Color adjustments are applied through CSS filters and persist for this browser session.</p>
      </div>}
    </div>
  );
}

function ColorSlider({ label, value, min, max, suffix, onChange }: { label: string; value: number; min: number; max: number; suffix: string; onChange: (value: number) => void }) {
  return (
    <Slider
      label={label}
      minValue={min}
      maxValue={max}
      step={1}
      value={value}
      onChange={(next) => onChange(Array.isArray(next) ? next[0] : next)}
      size="sm"
      color="foreground"
      classNames={{ label: "text-sm font-normal text-white/55", value: "text-sm font-normal text-white" }}
      getValue={(next) => `${next}${suffix}`}
    />
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
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white transition hover:bg-white/15"
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

function PlayerMessage({ text }: { text: string }) {
  return (
    <div className="flex h-full min-h-0 w-full items-center justify-center rounded-lg bg-black px-6 text-center text-sm text-white/70 ring-1 ring-white/10">
      {text}
    </div>
  );
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
