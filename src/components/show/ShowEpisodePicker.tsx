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
import { Button, Input, Tab, Tabs } from "@heroui/react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ArrowLeft01Icon,
  ArrowRight01Icon,
  PlayIcon,
} from "@hugeicons/core-free-icons";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
} from "@/components/ui/carousel";
import { formatRuntimeLabel } from "@/components/ui/catalogMediaPanel";
import { formatWatchEpKey } from "@/lib/watchProgress";
import { tmdbSeasonEpisodeFromAbsolute } from "@/lib/cumulativeTvEpisode";

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
  /** 1-based cumulative index when flatMode */
  displayNumber?: number;
};

const TMDB_STILL_BASE = "https://image.tmdb.org/t/p/original";
/** Visible episode cards in the horizontal scroller (4 full + ⅓ peek). */
const VISIBLE_EPISODE_SLOTS = 5;
const EPISODE_CAROUSEL_ITEM_CLASS =
  "pl-3 shrink-0 grow-0 basis-[calc(100%/4.3333333333)]";
const EPISODE_CARD_HEIGHT = "h-[360px]";
const EPISODE_CARD_STILL_HEIGHT = "h-[160px]";
const EPISODE_CARD_TITLE_CLASS =
  "shrink-0 overflow-hidden text-sm font-semibold leading-tight text-foreground [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2]";
const EPISODE_CARD_DESCRIPTION_CLASS =
  "h-[3.5rem] shrink-0 overflow-hidden text-sm leading-snug text-default-500 [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:3]";
const EPISODE_CARD_BODY_CLASS =
  "flex min-h-0 flex-1 flex-col overflow-hidden bg-default-100/90 py-3 pr-6 pl-0 dark:bg-default-50/10";

function episodeStillUrl(stillPath: string | null | undefined) {
  const path = String(stillPath ?? "").trim();
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  return `${TMDB_STILL_BASE}${path.startsWith("/") ? path : `/${path}`}`;
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
  flatMode?: boolean;
  flatEpisodeCap?: number | null;
  watchedKeys?: Set<string>;
  onMarkWatched?: (season: number, episode: number) => void;
  onEpisodesLoadingChange?: (loading: boolean) => void;
  onPlayableEpisodeCountChange?: (count: number) => void;
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

async function fetchSeasonEpisodes(
  tvId: string,
  seasonNum: number,
  signal?: AbortSignal
): Promise<EpisodeCardRow[]> {
  const qs = new URLSearchParams({
    tvId,
    season: String(seasonNum),
  });
  const res = await fetch(`/api/tv/season?${qs.toString()}`, { signal });
  if (!res.ok) throw new Error("season fetch failed");
  const json = await res.json();
  const rows = Array.isArray(json.episodes) ? json.episodes : [];
  return rows.map(
    (ep: {
      episode_number: number;
      name: string;
      overview?: string | null;
      runtime: number | null;
      still_path?: string | null;
    }) => ({
      season: seasonNum,
      episode: ep.episode_number,
      name: ep.name,
      overview: ep.overview ?? null,
      runtime: ep.runtime,
      still_path: ep.still_path ?? null,
    })
  );
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
  flatMode = false,
  flatEpisodeCap = null,
  watchedKeys,
  onMarkWatched,
  onEpisodesLoadingChange,
  onPlayableEpisodeCountChange,
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
          if (!cancelled) setEpisodes(capped);
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
          setEpisodes(
            fallbackEpisodes(selectedSeason, seasonObj?.episode_count ?? 0)
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
    onEpisodesLoadingChange,
  ]);

  useEffect(() => {
    onPlayableEpisodeCountChange?.(episodes.length);
  }, [episodes.length, onPlayableEpisodeCountChange]);

  const currentSeasonEpisodeCount = useMemo(() => {
    const inSeason = flatMode
      ? episodes.filter((row) => row.season === selectedSeason)
      : episodes;
    if (inSeason.length > 0) return inSeason.length;
    return (
      releasedSeasons.find((s) => s.season_number === selectedSeason)
        ?.episode_count ?? 0
    );
  }, [flatMode, episodes, selectedSeason, releasedSeasons]);

  const currentSeasonEpisodeLabel =
    currentSeasonEpisodeCount > 0
      ? `${currentSeasonEpisodeCount} episode${currentSeasonEpisodeCount === 1 ? "" : "s"}`
      : null;

  const isSelected = useCallback(
    (row: EpisodeCardRow) => {
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
    [flatMode, releasedSeasons, selectedSeason, selectedEpisode]
  );

  const handleSelect = (row: EpisodeCardRow) => {
    onSeasonChange(row.season);
    onEpisodeChange(row.season, row.episode);
    onMarkWatched?.(row.season, row.episode);
  };

  const currentEpisodeIndex = useMemo(() => {
    return episodes.findIndex((row) => isSelected(row));
  }, [episodes, isSelected]);

  const hasPreviousEpisode = useMemo(() => {
    if (loading || episodes.length === 0) return false;
    if (currentEpisodeIndex > 0) return true;
    if (flatMode) return false;
    const seasonIdx = releasedSeasons.findIndex(
      (s) => s.season_number === selectedSeason
    );
    return seasonIdx > 0;
  }, [
    loading,
    episodes.length,
    currentEpisodeIndex,
    flatMode,
    releasedSeasons,
    selectedSeason,
  ]);

  const hasNextEpisode = useMemo(() => {
    if (loading || episodes.length === 0) return false;
    if (
      currentEpisodeIndex >= 0 &&
      currentEpisodeIndex < episodes.length - 1
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
    episodes.length,
    currentEpisodeIndex,
    flatMode,
    releasedSeasons,
    selectedSeason,
  ]);

  const goPreviousEpisode = () => {
    if (!hasPreviousEpisode) return;
    if (currentEpisodeIndex > 0) {
      handleSelect(episodes[currentEpisodeIndex - 1]);
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
      currentEpisodeIndex < episodes.length - 1
    ) {
      handleSelect(episodes[currentEpisodeIndex + 1]);
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
        const cap = episodes.length;
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
      episodes.length,
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
    episodes,
    loading,
    error,
    jumpSeason,
    jumpEpisode,
    showSeasonTabs,
    flatMode,
    watchedKeys,
    selectedSeason,
    currentSeasonEpisodeLabel,
    hasPreviousEpisode,
    hasNextEpisode,
    goPreviousEpisode,
    goNextEpisode,
    handleJumpSeasonChange,
    handleJumpEpisodeChange,
    onSeasonChange,
    onEpisodeChange,
    isSelected,
    handleSelect,
  };
}

export function ShowEpisodePickerControls() {
  const {
    jumpSeason,
    jumpEpisode,
    hasPreviousEpisode,
    hasNextEpisode,
    goPreviousEpisode,
    goNextEpisode,
    handleJumpSeasonChange,
    handleJumpEpisodeChange,
  } = useEpisodePicker();

  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5" aria-label="Episode controls">
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
            aria-label="Previous episode"
            startContent={
              <HugeiconsIcon icon={ArrowLeft01Icon} size={14} className="shrink-0" />
            }
          >
            Prev
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
            aria-label="Next episode"
            endContent={
              <HugeiconsIcon icon={ArrowRight01Icon} size={14} className="shrink-0" />
            }
          >
          Next
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

  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
      {showSeasonTabs && releasedSeasons.length > 1 && !flatMode ? (
        <Tabs
          aria-label="Seasons"
          selectedKey={String(selectedSeason)}
          onSelectionChange={(key) => {
            const s = parseInt(String(key), 10);
            if (!Number.isFinite(s)) return;
            onSeasonChange(s);
            onEpisodeChange(s, 1);
          }}
          size="sm"
          variant="bordered"
          radius="md"
          classNames={{
            base: "w-auto max-w-full",
            tabList: "gap-0",
            tab: "h-8 min-h-8 px-3 text-xs",
            panel: "hidden",
          }}
        >
          {releasedSeasons.map((s) => (
            <Tab
              key={String(s.season_number)}
              title={`Season ${s.season_number}`}
            />
          ))}
        </Tabs>
      ) : null}
      {currentSeasonEpisodeLabel ? (
        <>
          {showSeasonTabs && releasedSeasons.length > 1 && !flatMode ? (
            <span className="text-sm text-default-400" aria-hidden>
              ·
            </span>
          ) : null}
          <span className="text-xs font-medium text-default-500">
            {currentSeasonEpisodeLabel}
          </span>
        </>
      ) : null}
    </div>
  );
}

export function ShowEpisodePickerList() {
  const {
    loading,
    error,
    episodes,
    flatMode,
    watchedKeys,
    isSelected,
    handleSelect,
  } = useEpisodePicker();

  return (
    <section className="flex w-full flex-col gap-4" aria-label="Episodes">
      <ShowEpisodePickerSeasonRow />
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
        <Carousel opts={{ align: "start", dragFree: true }} className="w-full">
          <CarouselContent className="-ml-3">
            {episodes.map((row) => {
              const active = isSelected(row);
              const labelNum =
                flatMode && row.displayNumber != null
                  ? row.displayNumber
                  : row.episode;
              const watchKey = formatWatchEpKey(row.season, row.episode);
              const watched = watchedKeys?.has(watchKey) ?? false;
              const runtime = formatRuntimeLabel(row.runtime);
              const stillUrl = episodeStillUrl(row.still_path);

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
                        <p className={EPISODE_CARD_DESCRIPTION_CLASS}>
                          {row.overview ?? ""}
                        </p>
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
