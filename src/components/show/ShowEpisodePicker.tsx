"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import Image from "next/image";
import { Button, Input, Select, SelectItem } from "@heroui/react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ArrowDown01Icon,
  ArrowLeft01Icon,
  ArrowRight01Icon,
  ArrowUpDownIcon,
  PlayIcon,
} from "@hugeicons/core-free-icons";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from "@/components/ui/carousel";
import { formatRuntimeLabel } from "@/components/ui/catalogMediaPanel";
import { tmdbImageUrl } from "@/lib/tmdbImage";
import { formatWatchEpKey } from "@/lib/watchProgress";
import { tmdbSeasonEpisodeFromAbsolute } from "@/lib/cumulativeTvEpisode";
import { useAnimeAudio } from "@/contexts/animeAudioContext";
import { animeAudioLabel, ANIME_AUDIO_OPTIONS } from "@/lib/animePlayEmbed";
import { readClientDayCache, writeClientDayCache } from "@/lib/clientDayCache";
import { filterReleasedEpisodes } from "@/lib/episodeRelease";

export type ShowEpisodePickerSeason = {
  season_number: number;
  episode_count?: number;
};

export type EpisodeCardRow = {
  season: number;
  episode: number;
  name: string;
  overview?: string | null;
  runtime: number | null;
  still_path?: string | null;
  air_date?: string | null;
  /** 1-based cumulative index when flatMode */
  displayNumber?: number;
};


export const SHOW_VIDEO_PLAYER_ID = "show-video-player";
const EPISODE_PICKER_LIST_ID = "show-episode-picker-list";
/** Visible episode cards in the horizontal scroller (4 full + ⅓ peek). */
const VISIBLE_EPISODE_SLOTS = 5;
const EPISODE_CAROUSEL_ITEM_CLASS =
  "pl-3 shrink-0 grow-0 basis-[72%] sm:basis-[48%] md:basis-[38%] lg:basis-[calc(100%/4.3333333333)]";
const EPISODE_CARD_HEIGHT = "h-[320px] sm:h-[360px]";
const EPISODE_CARD_STILL_HEIGHT = "h-[140px] sm:h-[160px]";
const EPISODE_CARD_TITLE_CLASS =
  "shrink-0 overflow-hidden text-sm font-semibold leading-tight text-foreground [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2]";
const EPISODE_CARD_DESCRIPTION_CLASS =
  "h-[3.5rem] shrink-0 overflow-hidden text-sm leading-snug text-default-500 [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:3]";
const EPISODE_CARD_BODY_CLASS =
  "flex min-h-0 flex-1 flex-col overflow-hidden py-3 pr-6 pl-0";

function scrollToPlayerBottom() {
  const player = document.getElementById(SHOW_VIDEO_PLAYER_ID);
  if (!player) return;
  const top =
    player.getBoundingClientRect().bottom + window.scrollY;
  window.scrollTo({ top, behavior: "smooth" });
}

function episodeStillUrl(stillPath: string | null | undefined) {
  return tmdbImageUrl(stillPath) || null;
}

function EpisodeCardSkeleton() {
  return (
    <div
      className={`flex ${EPISODE_CARD_HEIGHT} w-full min-w-0 flex-col overflow-hidden rounded-xl`}
      aria-hidden
    >
      <div
        className={`${EPISODE_CARD_STILL_HEIGHT} w-full shrink-0 animate-pulse bg-default-200 dark:bg-default-100/20`}
      />
      <div className={EPISODE_CARD_BODY_CLASS}>
        <div className="mb-1 h-4 w-[42%] max-w-[7rem] animate-pulse rounded-md bg-default-200 dark:bg-default-100/20" />
        <div className="flex flex-col gap-2">
          <div className="h-3.5 w-full shrink-0 animate-pulse rounded bg-default-200 dark:bg-default-100/20" />
          <div className="h-[3.5rem] shrink-0">
            <div className="flex h-full flex-col gap-1">
              <div className="h-3 w-full animate-pulse rounded bg-default-200 dark:bg-default-100/20" />
              <div className="h-3 w-full animate-pulse rounded bg-default-200 dark:bg-default-100/20" />
              <div className="h-3 w-[72%] animate-pulse rounded bg-default-200 dark:bg-default-100/20" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

type ShowEpisodePickerProps = {
  tmdbTvId: string | null;
  seasons: ShowEpisodePickerSeason[];
  selectedSeason: number;
  selectedEpisode: number;
  onSeasonChange: (season: number) => void;
  onEpisodeChange: (season: number, episode: number) => void;
  showSeasonTabs?: boolean;
  /** Anime: episode list from catalog counts; metadata from /api/anime/episodes (TMDB). */
  preferCatalogEpisodes?: boolean;
  malId?: number | null;
  /** Show backdrop/poster used when episode stills are missing (anime). */
  fallbackStillPath?: string | null;
  /** After TMDB flat fetch, remap to season 1 + absolute episode (anime UI). */
  catalogAbsoluteEpisodes?: boolean;
  flatMode?: boolean;
  flatEpisodeCap?: number | null;
  watchedKeys?: Set<string>;
  onMarkWatched?: (season: number, episode: number) => void;
  onEpisodesLoadingChange?: (loading: boolean) => void;
  onPlayableEpisodeCountChange?: (count: number) => void;
  /** Anime: Sub/Dub selector at the start of episode controls. */
  showAnimeAudio?: boolean;
};

type EpisodePickerContextValue = ReturnType<typeof useEpisodePickerState>;

const EpisodePickerContext = createContext<EpisodePickerContextValue | null>(
  null
);

function useEpisodePicker() {
  const ctx = useContext(EpisodePickerContext);
  if (!ctx) {
    throw new Error(
      "ShowEpisodePicker subcomponents must be used within ShowEpisodePickerProvider"
    );
  }
  return ctx;
}

function padEpisode(n: number) {
  return String(n).padStart(2, "0");
}

function episodeNavNumber(
  row: EpisodeCardRow,
  flatMode: boolean,
  catalogAbsoluteEpisodes: boolean
): number {
  if (flatMode && row.displayNumber != null && !catalogAbsoluteEpisodes) {
    return row.displayNumber;
  }
  return row.episode;
}

function formatEpNavLabel(episodeNumber: number): string {
  return `Ep ${episodeNumber}`;
}

function fallbackEpisodes(
  seasonNum: number,
  count: number
): EpisodeCardRow[] {
  const n = Math.max(0, Math.floor(count));
  return Array.from({ length: n }, (_, i) => ({
    season: seasonNum,
    episode: i + 1,
    name: `Episode ${i + 1}`,
    overview: null,
    runtime: null,
  }));
}

const TV_SEASON_CACHE_PREFIX = "teavie.cache.tv-season.v1:";
const ANIME_EPISODES_CACHE_PREFIX = "teavie.cache.anime-eps.v6:";

async function fetchAnimeEpisodes(
  malId: number,
  limit: number,
  signal?: AbortSignal
): Promise<EpisodeCardRow[]> {
  const cacheKey = `${ANIME_EPISODES_CACHE_PREFIX}${malId}:${limit}`;
  const cached = readClientDayCache<EpisodeCardRow[]>(cacheKey);
  if (cached) return cached;

  const qs = new URLSearchParams({
    malId: String(malId),
    limit: String(Math.max(1, limit)),
  });
  const res = await fetch(`/api/anime/episodes?${qs.toString()}`, { signal });
  if (!res.ok) throw new Error("anime episodes fetch failed");
  const json = await res.json();
  const rows = Array.isArray(json.episodes) ? json.episodes : [];
  const mapped = rows.map(
    (ep: {
      episode_number: number;
      name: string;
      overview?: string | null;
      runtime: number | null;
      still_path?: string | null;
      air_date?: string | null;
    }) => ({
      season: 1,
      episode: ep.episode_number,
      name: ep.name,
      overview: ep.overview ?? null,
      runtime: ep.runtime,
      still_path: ep.still_path ?? null,
      air_date: ep.air_date ?? null,
    })
  );
  writeClientDayCache(cacheKey, mapped);
  return mapped;
}

async function fetchSeasonEpisodes(
  tvId: string,
  seasonNum: number,
  signal?: AbortSignal
): Promise<EpisodeCardRow[]> {
  const cacheKey = `${TV_SEASON_CACHE_PREFIX}${tvId}:${seasonNum}`;
  const cached = readClientDayCache<EpisodeCardRow[]>(cacheKey);
  if (cached) return cached;

  const qs = new URLSearchParams({
    tvId,
    season: String(seasonNum),
  });
  const res = await fetch(`/api/tv/season?${qs.toString()}`, { signal });
  if (!res.ok) throw new Error("season fetch failed");
  const json = await res.json();
  const rows = Array.isArray(json.episodes) ? json.episodes : [];
  const mapped = rows.map(
    (ep: {
      episode_number: number;
      name: string;
      overview?: string | null;
      runtime: number | null;
      still_path?: string | null;
      air_date?: string | null;
    }) => ({
      season: seasonNum,
      episode: ep.episode_number,
      name: ep.name,
      overview: ep.overview ?? null,
      runtime: ep.runtime,
      still_path: ep.still_path ?? null,
      air_date: ep.air_date ?? null,
    })
  );
  writeClientDayCache(cacheKey, mapped);
  return mapped;
}

export function ShowEpisodePickerProvider({
  children,
  ...props
}: ShowEpisodePickerProps & { children: React.ReactNode }) {
  const value = useEpisodePickerState(props);
  return (
    <EpisodePickerContext.Provider value={value}>
      {children}
    </EpisodePickerContext.Provider>
  );
}

function useEpisodePickerState({
  tmdbTvId,
  seasons,
  selectedSeason,
  selectedEpisode,
  onSeasonChange,
  onEpisodeChange,
  showSeasonTabs = true,
  preferCatalogEpisodes = false,
  malId = null,
  fallbackStillPath = null,
  catalogAbsoluteEpisodes = false,
  flatMode = false,
  flatEpisodeCap = null,
  watchedKeys,
  onMarkWatched,
  onEpisodesLoadingChange,
  onPlayableEpisodeCountChange,
  showAnimeAudio = false,
}: ShowEpisodePickerProps) {
  const releasedSeasons = useMemo(
    () =>
      seasons
        .filter((s) => s.season_number >= 1 && (s.episode_count ?? 0) > 0)
        .sort((a, b) => a.season_number - b.season_number),
    [seasons]
  );

  const [episodes, setEpisodes] = useState<EpisodeCardRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const [jumpSeason, setJumpSeason] = useState(String(selectedSeason));
  const [jumpEpisode, setJumpEpisode] = useState(String(selectedEpisode));
  const [episodeSortLatestFirst, setEpisodeSortLatestFirst] = useState(true);

  const releasedEpisodes = useMemo(
    () => filterReleasedEpisodes(episodes),
    [episodes]
  );

  const displayedEpisodes = useMemo(
    () =>
      episodeSortLatestFirst
        ? [...releasedEpisodes].reverse()
        : releasedEpisodes,
    [releasedEpisodes, episodeSortLatestFirst]
  );

  const toggleEpisodeSort = useCallback(() => {
    setEpisodeSortLatestFirst((prev) => !prev);
  }, []);

  useEffect(() => {
    setJumpSeason(String(selectedSeason));
    setJumpEpisode(String(selectedEpisode));
  }, [selectedSeason, selectedEpisode]);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    const run = async () => {
      setLoading(true);
      setError(false);
      onEpisodesLoadingChange?.(true);

      try {
        if (preferCatalogEpisodes) {
          const seasonObj =
            releasedSeasons.find((s) => s.season_number === selectedSeason) ??
            releasedSeasons[0];
          let count = seasonObj?.episode_count ?? 0;
          if (count <= 0) {
            count = releasedSeasons.reduce(
              (acc, s) => acc + (s.episode_count ?? 0),
              0
            );
          }
          if (flatEpisodeCap != null && flatEpisodeCap > 0) {
            count = Math.min(count, flatEpisodeCap);
          }
          const seasonNum = seasonObj?.season_number ?? selectedSeason ?? 1;
          const mal = Math.floor(Number(malId));
          if (Number.isFinite(mal) && mal > 0 && count > 0) {
            try {
              const rows = await fetchAnimeEpisodes(mal, count, controller.signal);
              const released = filterReleasedEpisodes(
                rows.map((row) => ({ ...row, season: seasonNum }))
              );
              if (!cancelled) setEpisodes(released);
              return;
            } catch {
              if (!cancelled) {
                setEpisodes([]);
                setError(true);
              }
              return;
            }
          }
          if (!cancelled) {
            setEpisodes([]);
          }
          return;
        }

        if (!tmdbTvId || !/^\d+$/.test(tmdbTvId)) {
          if (flatMode) {
            const cap =
              flatEpisodeCap != null && flatEpisodeCap > 0
                ? flatEpisodeCap
                : releasedSeasons.reduce(
                    (acc, s) => acc + (s.episode_count ?? 0),
                    0
                  );
            const rows: EpisodeCardRow[] = [];
            for (let abs = 1; abs <= cap; abs++) {
              const coords = tmdbSeasonEpisodeFromAbsolute(releasedSeasons, abs);
              rows.push({
                season: coords.season,
                episode: coords.episode,
                name: `Episode ${abs}`,
                runtime: null,
                displayNumber: abs,
              });
            }
            if (!cancelled) setEpisodes(filterReleasedEpisodes(rows));
          } else {
            const seasonObj = releasedSeasons.find(
              (s) => s.season_number === selectedSeason
            );
            const count = seasonObj?.episode_count ?? 0;
            if (!cancelled) {
              setEpisodes(filterReleasedEpisodes(fallbackEpisodes(selectedSeason, count)));
            }
          }
          return;
        }

        if (flatMode) {
          const lists = await Promise.all(
            releasedSeasons.map((s) =>
              fetchSeasonEpisodes(tmdbTvId, s.season_number, controller.signal)
            )
          );
          let abs = 0;
          const flat: EpisodeCardRow[] = [];
          for (const list of lists) {
            for (const ep of list) {
              abs += 1;
              flat.push({ ...ep, displayNumber: abs });
            }
          }
          const capped =
            flatEpisodeCap != null && flatEpisodeCap > 0
              ? flat.slice(0, flatEpisodeCap)
              : flat;
          const finalRows = catalogAbsoluteEpisodes
            ? capped.map((ep) => ({
                ...ep,
                season: 1,
                episode: ep.displayNumber ?? ep.episode,
              }))
            : capped;
          if (!cancelled) setEpisodes(filterReleasedEpisodes(finalRows));
          return;
        }

        const rows = await fetchSeasonEpisodes(
          tmdbTvId,
          selectedSeason,
          controller.signal
        );
        if (!cancelled) setEpisodes(filterReleasedEpisodes(rows));
      } catch {
        if (!cancelled) {
          setError(true);
          const seasonObj = releasedSeasons.find(
            (s) => s.season_number === selectedSeason
          );
          setEpisodes(
            filterReleasedEpisodes(
              fallbackEpisodes(selectedSeason, seasonObj?.episode_count ?? 0)
            )
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
          onEpisodesLoadingChange?.(false);
        }
      }
    };

    void run();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [
    tmdbTvId,
    selectedSeason,
    flatMode,
    flatEpisodeCap,
    releasedSeasons,
    preferCatalogEpisodes,
    malId,
    catalogAbsoluteEpisodes,
    onEpisodesLoadingChange,
  ]);

  useEffect(() => {
    onPlayableEpisodeCountChange?.(releasedEpisodes.length);
  }, [releasedEpisodes.length, onPlayableEpisodeCountChange]);

  const currentSeasonEpisodeCount = useMemo(() => {
    const inSeason = flatMode
      ? releasedEpisodes.filter((row) => row.season === selectedSeason)
      : releasedEpisodes;
    if (inSeason.length > 0) return inSeason.length;
    return (
      releasedSeasons.find((s) => s.season_number === selectedSeason)
        ?.episode_count ?? 0
    );
  }, [flatMode, releasedEpisodes, selectedSeason, releasedSeasons]);

  const currentSeasonEpisodeLabel =
    currentSeasonEpisodeCount > 0
      ? `${currentSeasonEpisodeCount} episode${currentSeasonEpisodeCount === 1 ? "" : "s"}`
      : null;

  const isSelected = useCallback(
    (row: EpisodeCardRow) => {
      if (catalogAbsoluteEpisodes) {
        return row.season === selectedSeason && row.episode === selectedEpisode;
      }
      if (flatMode && row.displayNumber != null) {
        const coords = tmdbSeasonEpisodeFromAbsolute(
          releasedSeasons,
          row.displayNumber
        );
        return (
          selectedSeason === coords.season && selectedEpisode === coords.episode
        );
      }
      return row.season === selectedSeason && row.episode === selectedEpisode;
    },
    [catalogAbsoluteEpisodes, flatMode, releasedSeasons, selectedSeason, selectedEpisode]
  );

  const handleSelect = (row: EpisodeCardRow) => {
    onSeasonChange(row.season);
    onEpisodeChange(row.season, row.episode);
    onMarkWatched?.(row.season, row.episode);
  };

  const currentEpisodeIndex = useMemo(() => {
    return releasedEpisodes.findIndex((row) => isSelected(row));
  }, [releasedEpisodes, isSelected]);

  const hasPreviousEpisode = useMemo(() => {
    if (loading || releasedEpisodes.length === 0) return false;
    if (currentEpisodeIndex > 0) return true;
    if (flatMode) return false;
    const seasonIdx = releasedSeasons.findIndex(
      (s) => s.season_number === selectedSeason
    );
    return seasonIdx > 0;
  }, [
    loading,
    releasedEpisodes.length,
    currentEpisodeIndex,
    flatMode,
    releasedSeasons,
    selectedSeason,
  ]);

  const hasNextEpisode = useMemo(() => {
    if (loading || releasedEpisodes.length === 0) return false;
    if (
      currentEpisodeIndex >= 0 &&
      currentEpisodeIndex < releasedEpisodes.length - 1
    ) {
      return true;
    }
    if (flatMode) return false;
    const seasonIdx = releasedSeasons.findIndex(
      (s) => s.season_number === selectedSeason
    );
    return seasonIdx >= 0 && seasonIdx < releasedSeasons.length - 1;
  }, [
    loading,
    releasedEpisodes.length,
    currentEpisodeIndex,
    flatMode,
    releasedSeasons,
    selectedSeason,
  ]);

  const previousEpisodeLabel = useMemo(() => {
    if (!hasPreviousEpisode) return null;
    if (currentEpisodeIndex > 0) {
      const row = releasedEpisodes[currentEpisodeIndex - 1];
      return formatEpNavLabel(
        episodeNavNumber(row, flatMode, catalogAbsoluteEpisodes)
      );
    }
    const seasonIdx = releasedSeasons.findIndex(
      (s) => s.season_number === selectedSeason
    );
    if (seasonIdx <= 0) return null;
    const prevSeason = releasedSeasons[seasonIdx - 1];
    const lastEp = Math.max(1, prevSeason.episode_count ?? 1);
    return formatEpNavLabel(lastEp);
  }, [
    hasPreviousEpisode,
    currentEpisodeIndex,
    releasedEpisodes,
    flatMode,
    catalogAbsoluteEpisodes,
    releasedSeasons,
    selectedSeason,
  ]);

  const nextEpisodeLabel = useMemo(() => {
    if (!hasNextEpisode) return null;
    if (
      currentEpisodeIndex >= 0 &&
      currentEpisodeIndex < releasedEpisodes.length - 1
    ) {
      const row = releasedEpisodes[currentEpisodeIndex + 1];
      return formatEpNavLabel(
        episodeNavNumber(row, flatMode, catalogAbsoluteEpisodes)
      );
    }
    const seasonIdx = releasedSeasons.findIndex(
      (s) => s.season_number === selectedSeason
    );
    if (seasonIdx < 0 || seasonIdx >= releasedSeasons.length - 1) return null;
    return formatEpNavLabel(1);
  }, [
    hasNextEpisode,
    currentEpisodeIndex,
    releasedEpisodes,
    flatMode,
    catalogAbsoluteEpisodes,
    releasedSeasons,
    selectedSeason,
  ]);

  const goPreviousEpisode = () => {
    if (!hasPreviousEpisode) return;
    if (currentEpisodeIndex > 0) {
      handleSelect(releasedEpisodes[currentEpisodeIndex - 1]);
      return;
    }
    const seasonIdx = releasedSeasons.findIndex(
      (s) => s.season_number === selectedSeason
    );
    if (seasonIdx <= 0) return;
    const prevSeason = releasedSeasons[seasonIdx - 1];
    const lastEp = Math.max(1, prevSeason.episode_count ?? 1);
    onSeasonChange(prevSeason.season_number);
    onEpisodeChange(prevSeason.season_number, lastEp);
    onMarkWatched?.(prevSeason.season_number, lastEp);
  };

  const goNextEpisode = () => {
    if (!hasNextEpisode) return;
    if (
      currentEpisodeIndex >= 0 &&
      currentEpisodeIndex < releasedEpisodes.length - 1
    ) {
      handleSelect(releasedEpisodes[currentEpisodeIndex + 1]);
      return;
    }
    const seasonIdx = releasedSeasons.findIndex(
      (s) => s.season_number === selectedSeason
    );
    if (seasonIdx < 0 || seasonIdx >= releasedSeasons.length - 1) return;
    const nextSeason = releasedSeasons[seasonIdx + 1];
    onSeasonChange(nextSeason.season_number);
    onEpisodeChange(nextSeason.season_number, 1);
    onMarkWatched?.(nextSeason.season_number, 1);
  };

  const applyJumpFromInputs = useCallback(
    (seasonStr: string, episodeStr: string) => {
      const s = parseInt(seasonStr, 10);
      const e = parseInt(episodeStr, 10);
      if (!Number.isFinite(s) || s < 1 || !Number.isFinite(e) || e < 1) return;

      if (flatMode) {
        const cap = releasedEpisodes.length;
        const abs = Math.min(e, cap || e);
        if (cap < 1) return;
        const coords = tmdbSeasonEpisodeFromAbsolute(releasedSeasons, abs);
        if (
          coords.season === selectedSeason &&
          coords.episode === selectedEpisode
        ) {
          return;
        }
        onSeasonChange(coords.season);
        onEpisodeChange(coords.season, coords.episode);
        onMarkWatched?.(coords.season, coords.episode);
        return;
      }

      const seasonObj = releasedSeasons.find((x) => x.season_number === s);
      if (!seasonObj) return;
      const max = seasonObj.episode_count ?? 0;
      const ep = Math.min(e, max || e);
      if (s === selectedSeason && ep === selectedEpisode) return;
      onSeasonChange(s);
      onEpisodeChange(s, ep);
      onMarkWatched?.(s, ep);
    },
    [
      flatMode,
      releasedEpisodes.length,
      releasedSeasons,
      selectedSeason,
      selectedEpisode,
      onSeasonChange,
      onEpisodeChange,
      onMarkWatched,
    ]
  );

  const handleJumpSeasonChange = (value: string) => {
    setJumpSeason(value);
    applyJumpFromInputs(value, jumpEpisode);
  };

  const handleJumpEpisodeChange = (value: string) => {
    setJumpEpisode(value);
    applyJumpFromInputs(jumpSeason, value);
  };

  return {
    releasedSeasons,
    episodes: releasedEpisodes,
    displayedEpisodes,
    episodeSortLatestFirst,
    toggleEpisodeSort,
    loading,
    error,
    jumpSeason,
    jumpEpisode,
    showSeasonTabs,
    flatMode,
    catalogAbsoluteEpisodes,
    fallbackStillPath,
    watchedKeys,
    selectedSeason,
    currentSeasonEpisodeLabel,
    hasPreviousEpisode,
    hasNextEpisode,
    previousEpisodeLabel,
    nextEpisodeLabel,
    goPreviousEpisode,
    goNextEpisode,
    handleJumpSeasonChange,
    handleJumpEpisodeChange,
    onSeasonChange,
    onEpisodeChange,
    isSelected,
    handleSelect,
    showAnimeAudio,
  };
}

function AnimeAudioSelect() {
  const { audio, setAudio } = useAnimeAudio();

  return (
    <div className="flex shrink-0 items-center gap-1">
      <span className="text-[11px] font-medium text-default-500">Audio</span>
      <Select
        size="sm"
        aria-label="Audio"
        variant="bordered"
        radius="md"
        selectedKeys={new Set([audio])}
        onSelectionChange={(keys) => {
          const next = Array.from(keys)[0];
          if (next === "sub" || next === "dub") setAudio(next);
        }}
        classNames={{
          base: "w-[76px]",
          trigger: "h-8 min-h-8 border-default-300 px-2 dark:border-default-500/60",
          value: "text-xs font-normal text-foreground",
          selectorIcon: "text-default-400",
        }}
        popoverProps={{ classNames: { content: "min-w-[76px]" } }}
      >
        {ANIME_AUDIO_OPTIONS.map((lang) => (
          <SelectItem key={lang}>{animeAudioLabel(lang)}</SelectItem>
        ))}
      </Select>
    </div>
  );
}

export function ShowEpisodePickerControls() {
  const {
    jumpSeason,
    jumpEpisode,
    hasPreviousEpisode,
    hasNextEpisode,
    previousEpisodeLabel,
    nextEpisodeLabel,
    goPreviousEpisode,
    goNextEpisode,
    handleJumpSeasonChange,
    handleJumpEpisodeChange,
    showAnimeAudio,
  } = useEpisodePicker();

  return (
    <div className="flex w-full min-w-0 flex-wrap items-center gap-x-2 gap-y-1.5" aria-label="Episode controls">
          {showAnimeAudio ? (
            <>
              <AnimeAudioSelect />
              <span className="text-sm text-default-400" aria-hidden>
                ·
              </span>
            </>
          ) : null}
          <div className="flex shrink-0 items-center gap-1.5">
            <div className="flex items-center gap-1">
              <span className="text-[11px] font-medium text-default-500">S</span>
              <Input
                size="sm"
                type="number"
                min={1}
                aria-label="Season"
                variant="bordered"
                radius="md"
                value={jumpSeason}
                onValueChange={handleJumpSeasonChange}
                classNames={{
                  base: "w-[48px]",
                  input: "text-xs tabular-nums",
                  inputWrapper: "h-8 min-h-8 px-2",
                }}
              />
            </div>
            <div className="flex items-center gap-1">
              <span className="text-[11px] font-medium text-default-500">E</span>
              <Input
                size="sm"
                type="number"
                min={1}
                aria-label="Episode"
                variant="bordered"
                radius="md"
                value={jumpEpisode}
                onValueChange={handleJumpEpisodeChange}
                classNames={{
                  base: "w-[48px]",
                  input: "text-xs tabular-nums",
                  inputWrapper: "h-8 min-h-8 px-2",
                }}
              />
            </div>
          </div>
          <span className="text-sm text-default-400" aria-hidden>
            ·
          </span>
          <Button
            size="sm"
            variant="bordered"
            radius="md"
            className="h-8 min-h-8 text-xs"
            isDisabled={!hasPreviousEpisode}
            onPress={goPreviousEpisode}
            aria-label={
              previousEpisodeLabel
                ? `Go to ${previousEpisodeLabel}`
                : "Previous episode"
            }
            startContent={
              <HugeiconsIcon icon={ArrowLeft01Icon} size={14} className="shrink-0" />
            }
          >
            {previousEpisodeLabel ?? "Prev"}
          </Button>
          <span className="text-sm text-default-400" aria-hidden>
            ·
          </span>
          <Button
            size="sm"
            variant="bordered"
            radius="md"
            className="h-8 min-h-8 text-xs"
            isDisabled={!hasNextEpisode}
            onPress={goNextEpisode}
            aria-label={
              nextEpisodeLabel ? `Go to ${nextEpisodeLabel}` : "Next episode"
            }
            endContent={
              <HugeiconsIcon icon={ArrowRight01Icon} size={14} className="shrink-0" />
            }
          >
            {nextEpisodeLabel ?? "Next"}
          </Button>
      <span className="hidden text-sm text-default-400 sm:inline" aria-hidden>
        ·
      </span>
      <Button
        size="sm"
        variant="bordered"
        radius="md"
        className="hidden h-8 min-h-8 text-xs sm:inline-flex"
        onPress={scrollToPlayerBottom}
        aria-label="Scroll to bottom of player"
        endContent={
          <HugeiconsIcon icon={ArrowDown01Icon} size={14} className="shrink-0" />
        }
      >
        Episodes
      </Button>
    </div>
  );
}

function ShowEpisodePickerSeasonRow() {
  const {
    showSeasonTabs,
    flatMode,
    releasedSeasons,
    selectedSeason,
    onSeasonChange,
    onEpisodeChange,
    currentSeasonEpisodeLabel,
  } = useEpisodePicker();

  if (
    !(showSeasonTabs && releasedSeasons.length > 1 && !flatMode) &&
    !currentSeasonEpisodeLabel
  ) {
    return null;
  }

  const manySeasons = releasedSeasons.length > 3;

  return (
    <div className="flex w-full min-w-0 flex-col gap-1.5 lg:flex-row lg:items-center lg:gap-x-2">
      {showSeasonTabs && releasedSeasons.length > 1 && !flatMode ? (
        <Select
          aria-label="Season"
          size="sm"
          variant="bordered"
          radius="md"
          selectedKeys={new Set([String(selectedSeason)])}
          onSelectionChange={(keys) => {
            const key = Array.from(keys)[0];
            const s = parseInt(String(key), 10);
            if (!Number.isFinite(s)) return;
            onSeasonChange(s);
            onEpisodeChange(s, 1);
          }}
          classNames={{
            base: manySeasons
              ? "w-full min-w-0 max-w-full lg:w-[9.5rem]"
              : "w-full min-w-0 max-w-full lg:w-auto",
            trigger:
              "h-8 min-h-8 border-default-300 px-2 dark:border-default-500/60",
            value: "text-xs font-normal text-foreground",
            selectorIcon: "text-default-400",
          }}
          popoverProps={{ classNames: { content: "min-w-[9rem]" } }}
        >
          {releasedSeasons.map((s) => (
            <SelectItem
              key={String(s.season_number)}
              textValue={`Season ${s.season_number}`}
            >
              Season {s.season_number}
            </SelectItem>
          ))}
        </Select>
      ) : null}
      {currentSeasonEpisodeLabel ? (
        <span className="shrink-0 text-xs font-medium text-default-500 sm:text-sm">
          {currentSeasonEpisodeLabel}
        </span>
      ) : null}
    </div>
  );
}

type EmblaCarouselApi = NonNullable<CarouselApi>;

function scrollEpisodeCarouselPrev(api: EmblaCarouselApi) {
  const inView = api.slidesInView();
  if (inView.length === 0) {
    api.scrollPrev();
    return;
  }
  const firstInView = Math.min(...inView);
  const step = Math.max(1, inView.length);
  api.scrollTo(Math.max(0, firstInView - step));
}

function scrollEpisodeCarouselNext(api: EmblaCarouselApi) {
  const inView = api.slidesInView();
  const snapCount = api.scrollSnapList().length;
  if (inView.length === 0) {
    api.scrollNext();
    return;
  }
  const lastInView = Math.max(...inView);
  const nextIndex = lastInView + 1;
  if (nextIndex < snapCount) {
    api.scrollTo(nextIndex);
    return;
  }
  api.scrollNext();
}

function EpisodeCarouselScrollArrows({ api }: { api: CarouselApi | null }) {
  const [canScrollPrev, setCanScrollPrev] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(false);

  useEffect(() => {
    if (!api) {
      setCanScrollPrev(false);
      setCanScrollNext(false);
      return;
    }
    const sync = () => {
      setCanScrollPrev(api.canScrollPrev());
      setCanScrollNext(api.canScrollNext());
    };
    sync();
    api.on("reInit", sync);
    api.on("select", sync);
    return () => {
      api.off("reInit", sync);
      api.off("select", sync);
    };
  }, [api]);

  if (!api) return null;

  return (
    <>
      <Button
        size="sm"
        variant="bordered"
        radius="md"
        isIconOnly
        className="h-8 w-8 min-w-8"
        isDisabled={!canScrollPrev}
        onPress={() => scrollEpisodeCarouselPrev(api)}
        aria-label="Scroll to earlier episodes"
      >
        <HugeiconsIcon icon={ArrowLeft01Icon} size={14} />
      </Button>
      <Button
        size="sm"
        variant="bordered"
        radius="md"
        isIconOnly
        className="h-8 w-8 min-w-8"
        isDisabled={!canScrollNext}
        onPress={() => scrollEpisodeCarouselNext(api)}
        aria-label="Scroll to later episodes"
      >
        <HugeiconsIcon icon={ArrowRight01Icon} size={14} />
      </Button>
    </>
  );
}

export function ShowEpisodePickerList() {
  const {
    loading,
    error,
    episodes,
    displayedEpisodes,
    episodeSortLatestFirst,
    toggleEpisodeSort,
    flatMode,
    catalogAbsoluteEpisodes,
    watchedKeys,
    fallbackStillPath,
    isSelected,
    handleSelect,
  } = useEpisodePicker();

  const [episodeCarouselApi, setEpisodeCarouselApi] = useState<CarouselApi | null>(
    null
  );

  useEffect(() => {
    if (loading) setEpisodeCarouselApi(null);
  }, [loading]);

  useEffect(() => {
    episodeCarouselApi?.reInit();
  }, [displayedEpisodes, episodeCarouselApi]);

  return (
    <section
      id={EPISODE_PICKER_LIST_ID}
      className="flex w-full scroll-mt-6 flex-col gap-4"
      aria-label="Episodes"
    >
      <div className="flex w-full min-w-0 items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <ShowEpisodePickerSeasonRow />
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {!loading && episodes.length > 1 ? (
            <Button
              size="sm"
              variant={episodeSortLatestFirst ? "solid" : "bordered"}
              color={episodeSortLatestFirst ? "success" : "default"}
              radius="md"
              isIconOnly
              className="h-8 w-8 min-w-8 shrink-0"
              onPress={toggleEpisodeSort}
              aria-pressed={episodeSortLatestFirst}
              aria-label={
                episodeSortLatestFirst
                  ? "Showing latest episodes first. Sort oldest first."
                  : "Showing oldest episodes first. Sort latest first."
              }
            >
              <HugeiconsIcon icon={ArrowUpDownIcon} size={14} className="shrink-0" />
            </Button>
          ) : null}
          <EpisodeCarouselScrollArrows api={episodeCarouselApi} />
        </div>
      </div>
      {loading ? (
        <Carousel opts={{ align: "start", dragFree: true }} className="w-full">
          <CarouselContent className="-ml-3">
            {Array.from({ length: VISIBLE_EPISODE_SLOTS }).map((_, i) => (
              <CarouselItem key={i} className={EPISODE_CAROUSEL_ITEM_CLASS}>
                <EpisodeCardSkeleton />
              </CarouselItem>
            ))}
          </CarouselContent>
        </Carousel>
      ) : error && episodes.length === 0 ? (
        <p className="text-sm text-default-500">Could not load episodes.</p>
      ) : episodes.length === 0 ? (
        <p className="text-sm text-default-500">
          Nothing to show for this season yet.
        </p>
      ) : (
        <Carousel
          opts={{ align: "start", dragFree: true }}
          setApi={setEpisodeCarouselApi}
          className="w-full"
        >
          <CarouselContent className="-ml-3">
            {displayedEpisodes.map((row) => {
              const active = isSelected(row);
              const labelNum =
                flatMode && row.displayNumber != null && !catalogAbsoluteEpisodes
                  ? row.displayNumber
                  : row.episode;
              const watchKey = formatWatchEpKey(row.season, row.episode);
              const watched = watchedKeys?.has(watchKey) ?? false;
              const runtime = formatRuntimeLabel(row.runtime);
              const stillUrl =
                episodeStillUrl(row.still_path) ??
                episodeStillUrl(fallbackStillPath);

              return (
                <CarouselItem
                  key={`${row.season}-${row.episode}-${row.displayNumber ?? ""}`}
                  className={EPISODE_CAROUSEL_ITEM_CLASS}
                >
                  <button
                    type="button"
                    onClick={() => handleSelect(row)}
                    aria-label={`Episode ${labelNum}: ${row.name}${watched ? ", watched" : ""}`}
                    aria-current={active ? "true" : undefined}
                    className={`group relative flex ${EPISODE_CARD_HEIGHT} w-full min-w-0 flex-col overflow-hidden rounded-xl text-left`}
                  >
                    <div
                      className={`relative ${EPISODE_CARD_STILL_HEIGHT} w-full shrink-0 overflow-hidden bg-default-200/80 dark:bg-default-100/15 ${
                        active ? "ring-2 ring-inset ring-foreground" : ""
                      }`}
                    >
                      {stillUrl ? (
                        <Image
                          src={stillUrl}
                          alt=""
                          aria-hidden
                          fill
                          unoptimized
                          sizes="(max-width: 640px) 50vw, (max-width: 1280px) 25vw, 320px"
                          quality={85}
                          className="object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                      ) : null}
                      <div
                        className={`absolute inset-0 z-[1] flex items-center justify-center transition-opacity duration-200 ${
                          stillUrl
                            ? "opacity-0 group-hover:bg-black/40 group-hover:opacity-100"
                            : ""
                        }`}
                      >
                        <HugeiconsIcon
                          icon={PlayIcon}
                          size={stillUrl ? 24 : 28}
                          className={
                            stillUrl
                              ? "text-white drop-shadow-md"
                              : "text-secondary"
                          }
                        />
                      </div>
                      {watched ? (
                        <span
                          className="pointer-events-none absolute right-2 top-2 z-[2] h-1.5 w-1.5 rounded-full bg-success ring-2 ring-background"
                          aria-hidden
                        />
                      ) : null}
                    </div>
                    <div className={EPISODE_CARD_BODY_CLASS}>
                      <span className="mb-1 shrink-0 text-sm font-medium text-default-500">
                        E{padEpisode(labelNum)}
                        {runtime ? (
                          <>
                            <span aria-hidden> · </span>
                            {runtime}
                          </>
                        ) : null}
                      </span>
                      <div className="flex flex-col gap-2">
                        <span className={EPISODE_CARD_TITLE_CLASS}>{row.name}</span>
                        {row.overview?.trim() ? (
                          <p className={EPISODE_CARD_DESCRIPTION_CLASS}>
                            {row.overview}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </button>
                </CarouselItem>
              );
            })}
          </CarouselContent>
        </Carousel>
      )}
    </section>
  );
}

export default function ShowEpisodePicker(props: ShowEpisodePickerProps) {
  return (
    <ShowEpisodePickerProvider {...props}>
      <section className="flex w-full flex-col gap-4" aria-label="Episodes">
        <ShowEpisodePickerControls />
        <ShowEpisodePickerList />
      </section>
    </ShowEpisodePickerProvider>
  );
}
