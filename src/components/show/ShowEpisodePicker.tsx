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
  Calendar03Icon,
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
import { filterReleasedEpisodes, formatEpisodeAirDate, isEpisodeUpcoming } from "@/lib/episodeRelease";

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
/** Visible episode cards in the horizontal scroller (5 on desktop). */
const VISIBLE_EPISODE_SLOTS = 5;
const EPISODE_CAROUSEL_OPTS = {
  align: "start" as const,
  dragFree: true,
  /** Embla scroll animation length — higher = smoother/slower programmatic scroll. */
  duration: 42,
};
const EPISODE_CAROUSEL_ITEM_CLASS =
  "pl-3 shrink-0 grow-0 basis-[72%] sm:basis-[48%] md:basis-[calc(100%/3.2)] lg:basis-[calc(100%/5)]";
const EPISODE_CAROUSEL_ITEM_CURRENT_CLASS =
  "pl-3 shrink-0 grow-0 basis-[86%] sm:basis-[58%] md:basis-[calc(100%/2.85)] lg:basis-[calc(100%/5)]";
const EPISODE_CARD_HEIGHT = "h-[320px] sm:h-[360px] xl:h-[340px]";
const EPISODE_CARD_HEIGHT_CURRENT = "h-[360px] sm:h-[400px] xl:h-[380px]";
const EPISODE_CARD_STILL_HEIGHT = "h-[140px] sm:h-[160px] xl:h-[150px]";
const EPISODE_CARD_STILL_HEIGHT_CURRENT = "h-[172px] sm:h-[196px] xl:h-[184px]";
const EPISODE_CARD_TITLE_CLASS =
  "shrink-0 overflow-hidden text-sm font-normal leading-tight text-foreground [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2]";
const EPISODE_CARD_DESCRIPTION_CLASS =
  "h-[3.5rem] shrink-0 overflow-hidden text-sm leading-snug text-default-500 [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:3]";
const EPISODE_CARD_BODY_CLASS =
  "flex min-h-0 flex-1 flex-col overflow-hidden py-3 pr-6 pl-0";

function episodeStillFallbackClass(season: number, episode: number): string {
  const palettes = [
    "from-violet-500/40 via-indigo-400/20 to-default-100",
    "from-sky-500/40 via-cyan-400/20 to-default-100",
    "from-emerald-500/40 via-teal-400/20 to-default-100",
    "from-amber-500/35 via-orange-400/15 to-default-100",
    "from-rose-500/35 via-pink-400/15 to-default-100",
  ];
  const idx = (season * 31 + episode) % palettes.length;
  return `bg-gradient-to-br ${palettes[idx]} dark:from-opacity-30 dark:via-opacity-20 dark:to-default-100/10`;
}

type EpisodeCardVisualState = "current" | "watched" | "upcoming" | "default";

function episodeCardVisualState(
  row: EpisodeCardRow,
  active: boolean,
  watched: boolean
): EpisodeCardVisualState {
  if (isEpisodeUpcoming(row.air_date)) return "upcoming";
  if (active) return "current";
  if (watched) return "watched";
  return "default";
}

function episodeCardShellClass(state: EpisodeCardVisualState): string {
  switch (state) {
    case "current":
      return "bg-success/5 shadow-sm shadow-success/10";
    case "watched":
      return "bg-default-50/50 dark:bg-default-100/5";
    case "upcoming":
      return "bg-default-100/40 opacity-80 dark:bg-default-100/10";
    default:
      return "";
  }
}

function EpisodeStateLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-default-500">
      <span className="inline-flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-full bg-success ring-2 ring-success/25" aria-hidden />
        Now playing
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-full bg-success ring-2 ring-success/25" aria-hidden />
        Watched
      </span>
      <span className="inline-flex items-center gap-1.5">
        <HugeiconsIcon icon={Calendar03Icon} size={13} className="text-default-400" />
        Upcoming
      </span>
    </div>
  );
}

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

function selectedEpisodeIndex(
  list: EpisodeCardRow[],
  season: number,
  episode: number
): number {
  return list.findIndex(
    (row) => row.season === season && row.episode === episode
  );
}

/** Scroll so the active episode sits in the second visible slot when possible. */
function scrollCarouselToSelectedSecond(
  api: CarouselApi | undefined,
  list: EpisodeCardRow[],
  season: number,
  episode: number
) {
  if (!api) return;
  const selectedIndex = selectedEpisodeIndex(list, season, episode);
  if (selectedIndex < 0) return;
  const targetIndex = Math.max(0, selectedIndex - 1);
  api.scrollTo(targetIndex, false);
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
const ANIME_EPISODES_CACHE_PREFIX = "teavie.cache.anime-eps.v7:";
/** Airing anime often have unknown totals (AniList episodes = 0); still fetch metadata. */
const DEFAULT_ANIME_EPISODE_FETCH_LIMIT = 500;

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
  const [episodeSortLatestFirst, setEpisodeSortLatestFirst] = useState(false);

  const releasedEpisodes = useMemo(
    () => filterReleasedEpisodes(episodes),
    [episodes]
  );

  const displayedEpisodes = useMemo(
    () => (episodeSortLatestFirst ? [...episodes].reverse() : episodes),
    [episodes, episodeSortLatestFirst]
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
          const seasonNum = seasonObj?.season_number ?? selectedSeason ?? 1;
          const mal = Math.floor(Number(malId));
          let fetchLimit =
            count > 0
              ? count
              : flatEpisodeCap != null && flatEpisodeCap > 0
                ? flatEpisodeCap
                : DEFAULT_ANIME_EPISODE_FETCH_LIMIT;
          if (flatEpisodeCap != null && flatEpisodeCap > 0 && count > 0) {
            fetchLimit = Math.min(count, flatEpisodeCap);
          }
          if (Number.isFinite(mal) && mal > 0) {
            try {
              const rows = await fetchAnimeEpisodes(
                mal,
                fetchLimit,
                controller.signal
              );
              const released = rows.map((row) => ({ ...row, season: seasonNum }));
              if (!cancelled) setEpisodes(released);
              return;
            } catch {
              if (!cancelled) {
                if (count > 0) {
                  setEpisodes(fallbackEpisodes(seasonNum, count));
                  setError(false);
                } else {
                  setEpisodes([]);
                  setError(true);
                }
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
            if (!cancelled) setEpisodes(rows);
          } else {
            const seasonObj = releasedSeasons.find(
              (s) => s.season_number === selectedSeason
            );
            const count = seasonObj?.episode_count ?? 0;
            if (!cancelled) {
              setEpisodes(fallbackEpisodes(selectedSeason, count));
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
          if (!cancelled) setEpisodes(finalRows);
          return;
        }

        const rows = await fetchSeasonEpisodes(
          tmdbTvId,
          selectedSeason,
          controller.signal
        );
        if (!cancelled) setEpisodes(rows);
      } catch {
        if (!cancelled) {
          setError(true);
          const seasonObj = releasedSeasons.find(
            (s) => s.season_number === selectedSeason
          );
          setEpisodes(fallbackEpisodes(selectedSeason, seasonObj?.episode_count ?? 0));
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
    if (isEpisodeUpcoming(row.air_date)) return;
    onSeasonChange(row.season);
    onEpisodeChange(row.season, row.episode);
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
        return;
      }

      const seasonObj = releasedSeasons.find((x) => x.season_number === s);
      if (!seasonObj) return;
      const max = seasonObj.episode_count ?? 0;
      const ep = Math.min(e, max || e);
      if (s === selectedSeason && ep === selectedEpisode) return;
      onSeasonChange(s);
      onEpisodeChange(s, ep);
    },
    [
      flatMode,
      releasedEpisodes.length,
      releasedSeasons,
      selectedSeason,
      selectedEpisode,
      onSeasonChange,
      onEpisodeChange,
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
    episodes,
    releasedEpisodes,
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
    selectedEpisode,
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
    api.scrollPrev(false);
    return;
  }
  const firstInView = Math.min(...inView);
  const step = Math.max(1, inView.length);
  api.scrollTo(Math.max(0, firstInView - step), false);
}

function scrollEpisodeCarouselNext(api: EmblaCarouselApi) {
  const inView = api.slidesInView();
  const snapCount = api.scrollSnapList().length;
  if (inView.length === 0) {
    api.scrollNext(false);
    return;
  }
  const lastInView = Math.max(...inView);
  const nextIndex = lastInView + 1;
  if (nextIndex < snapCount) {
    api.scrollTo(nextIndex, false);
    return;
  }
  api.scrollNext(false);
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
    selectedSeason,
    selectedEpisode,
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

  useEffect(() => {
    if (!episodeCarouselApi || loading) return;

    const alignToCurrent = () => {
      scrollCarouselToSelectedSecond(
        episodeCarouselApi,
        displayedEpisodes,
        selectedSeason,
        selectedEpisode
      );
    };

    let innerRaf = 0;
    const scheduleAlign = () => {
      cancelAnimationFrame(innerRaf);
      innerRaf = requestAnimationFrame(() => {
        innerRaf = requestAnimationFrame(alignToCurrent);
      });
    };

    const onReInit = () => scheduleAlign();
    episodeCarouselApi.on("reInit", onReInit);
    scheduleAlign();

    return () => {
      episodeCarouselApi.off("reInit", onReInit);
      cancelAnimationFrame(innerRaf);
    };
  }, [
    episodeCarouselApi,
    loading,
    displayedEpisodes,
    selectedSeason,
    selectedEpisode,
  ]);

  return (
    <section
      id={EPISODE_PICKER_LIST_ID}
      className="flex w-full scroll-mt-6 flex-col gap-4"
      aria-label="Episodes"
    >
      <div className="flex w-full min-w-0 flex-col gap-2 xl:flex-row xl:items-start xl:justify-between">
        <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
          <ShowEpisodePickerSeasonRow />
          {!loading && episodes.length > 0 ? (
            <EpisodeStateLegend />
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-1.5 self-end xl:self-auto">
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
        <Carousel opts={EPISODE_CAROUSEL_OPTS} className="w-full">
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
          opts={EPISODE_CAROUSEL_OPTS}
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
              const upcoming = isEpisodeUpcoming(row.air_date);
              const cardState = episodeCardVisualState(row, active, watched);
              const runtime = formatRuntimeLabel(row.runtime);
              const stillUrl =
                episodeStillUrl(row.still_path) ??
                episodeStillUrl(fallbackStillPath);
              const airDateLabel = formatEpisodeAirDate(row.air_date);

              return (
                <CarouselItem
                  key={`${row.season}-${row.episode}-${row.displayNumber ?? ""}`}
                  className={active ? EPISODE_CAROUSEL_ITEM_CURRENT_CLASS : EPISODE_CAROUSEL_ITEM_CLASS}
                >
                  <button
                    type="button"
                    onClick={() => handleSelect(row)}
                    disabled={upcoming}
                    aria-label={`Episode ${labelNum}: ${row.name}${
                      active ? ", now playing" : watched ? ", watched" : upcoming ? ", upcoming" : ""
                    }`}
                    aria-current={active ? "true" : undefined}
                    aria-disabled={upcoming ? true : undefined}
                    className={`group relative flex w-full min-w-0 flex-col overflow-hidden rounded-xl text-left transition-all duration-300 ${
                      active ? EPISODE_CARD_HEIGHT_CURRENT : EPISODE_CARD_HEIGHT
                    } ${episodeCardShellClass(cardState)} ${
                      upcoming ? "cursor-not-allowed" : ""
                    }`}
                  >
                    <div
                      className={`relative w-full shrink-0 overflow-hidden ${
                        active ? EPISODE_CARD_STILL_HEIGHT_CURRENT : EPISODE_CARD_STILL_HEIGHT
                      } ${
                        stillUrl
                          ? "bg-default-200/80 dark:bg-default-100/15"
                          : episodeStillFallbackClass(row.season, row.episode)
                      } ${upcoming ? "grayscale-[0.35]" : ""}`}
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
                          className={`object-cover transition-transform duration-300 ${
                            upcoming ? "" : "group-hover:scale-105"
                          } ${watched && !active ? "opacity-90" : ""}`}
                        />
                      ) : null}
                      <div
                        className={`absolute inset-0 z-[1] flex items-center justify-center transition-opacity duration-200 ${
                          stillUrl && !upcoming
                            ? "opacity-0 group-hover:bg-black/40 group-hover:opacity-100"
                            : ""
                        }`}
                      >
                        {!upcoming ? (
                          <HugeiconsIcon
                            icon={PlayIcon}
                            size={stillUrl ? 24 : 28}
                            className={
                              stillUrl
                                ? "text-white drop-shadow-md"
                                : "text-foreground/70"
                            }
                          />
                        ) : null}
                      </div>
                      {active ? (
                        <span className="pointer-events-none absolute left-2 top-2 z-[2] rounded-md bg-success px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-success-foreground">
                          Now playing
                        </span>
                      ) : null}
                      {upcoming && airDateLabel ? (
                        <span className="pointer-events-none absolute left-2 top-2 z-[2] inline-flex items-center gap-1 rounded-md bg-background/85 px-2 py-0.5 text-[10px] font-medium text-default-600 backdrop-blur-sm dark:bg-background/70 dark:text-default-300">
                          <HugeiconsIcon icon={Calendar03Icon} size={11} className="shrink-0" />
                          {airDateLabel}
                        </span>
                      ) : null}
                      {watched && !active ? (
                        <span
                          className="pointer-events-none absolute right-2 top-2 z-[2] h-2 w-2 rounded-full bg-success ring-2 ring-success/25 shadow-sm"
                          aria-hidden
                        />
                      ) : null}
                    </div>
                    <div className={EPISODE_CARD_BODY_CLASS}>
                      <span
                        className={`mb-1 shrink-0 text-sm font-medium ${
                          active
                            ? "text-success"
                            : upcoming
                              ? "text-default-400"
                              : "text-default-500"
                        }`}
                      >
                        E{padEpisode(labelNum)}
                        {runtime ? (
                          <>
                            <span aria-hidden> · </span>
                            {runtime}
                          </>
                        ) : null}
                        {upcoming ? (
                          <>
                            <span aria-hidden> · </span>
                            Upcoming
                          </>
                        ) : null}
                      </span>
                      <div className="flex flex-col gap-2">
                        <span
                          className={`${EPISODE_CARD_TITLE_CLASS} ${
                            active ? "text-base sm:text-[17px]" : ""
                          } ${upcoming ? "text-default-500" : ""}`}
                        >
                          {row.name}
                        </span>
                        {row.overview?.trim() ? (
                          <p
                            className={`${EPISODE_CARD_DESCRIPTION_CLASS} ${
                              upcoming ? "text-default-400" : ""
                            }`}
                          >
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
