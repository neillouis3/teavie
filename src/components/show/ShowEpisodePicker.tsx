"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Button, Input } from "@heroui/react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ArrowLeft01Icon,
  ArrowRight01Icon,
  Clock01Icon,
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
  runtime: number | null;
  still_path?: string | null;
  /** 1-based cumulative index when flatMode */
  displayNumber?: number;
};

const TMDB_STILL_BASE = "https://image.tmdb.org/t/p/w300";
/** Visible episode cards in the horizontal scroller (one row). */
const VISIBLE_EPISODE_SLOTS = 7;
const EPISODE_CAROUSEL_ITEM_CLASS =
  "pl-3 shrink-0 grow-0 basis-[calc(100%/7)]";

function episodeStillUrl(stillPath: string | null | undefined) {
  const path = String(stillPath ?? "").trim();
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  return `${TMDB_STILL_BASE}${path.startsWith("/") ? path : `/${path}`}`;
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
      runtime: number | null;
      still_path?: string | null;
    }) => ({
      season: seasonNum,
      episode: ep.episode_number,
      name: ep.name,
      runtime: ep.runtime,
      still_path: ep.still_path ?? null,
    })
  );
}

export default function ShowEpisodePicker({
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

  const handleJump = () => {
    const s = parseInt(jumpSeason, 10);
    const e = parseInt(jumpEpisode, 10);
    if (!Number.isFinite(s) || s < 1) return;

    if (flatMode) {
      const cap = episodes.length;
      const abs = Number.isFinite(e) && e >= 1 ? Math.min(e, cap || e) : 1;
      if (cap < 1) return;
      const coords = tmdbSeasonEpisodeFromAbsolute(releasedSeasons, abs);
      onSeasonChange(coords.season);
      onEpisodeChange(coords.season, coords.episode);
      onMarkWatched?.(coords.season, coords.episode);
      return;
    }

    const seasonObj = releasedSeasons.find((x) => x.season_number === s);
    if (!seasonObj) return;
    const max = seasonObj.episode_count ?? 0;
    const ep = Number.isFinite(e) && e >= 1 ? Math.min(e, max || e) : 1;
    onSeasonChange(s);
    onEpisodeChange(s, ep);
    onMarkWatched?.(s, ep);
  };

  return (
    <section className="flex w-full flex-col gap-4" aria-label="Episodes">
      <div className="flex flex-wrap items-end justify-end gap-2">
        <form
          className="flex shrink-0 items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            handleJump();
          }}
        >
          <Input
            size="sm"
            type="number"
            min={1}
            label="S"
            labelPlacement="outside-top"
            variant="bordered"
            radius="md"
            aria-label="Season"
            value={jumpSeason}
            onValueChange={setJumpSeason}
            classNames={{
              base: "w-[72px]",
              label: "text-xs font-medium text-default-500",
              input: "text-sm tabular-nums",
              inputWrapper: "h-9 min-h-9",
            }}
          />
          <Input
            size="sm"
            type="number"
            min={1}
            label="E"
            labelPlacement="outside-top"
            variant="bordered"
            radius="md"
            aria-label="Episode"
            value={jumpEpisode}
            onValueChange={setJumpEpisode}
            classNames={{
              base: "w-[72px]",
              label: "text-xs font-medium text-default-500",
              input: "text-sm tabular-nums",
              inputWrapper: "h-9 min-h-9",
            }}
          />
          <Button
            type="submit"
            size="sm"
            variant="bordered"
            radius="md"
            className="h-9 min-w-[52px] flex-col gap-0 px-2"
          >
            <HugeiconsIcon icon={ArrowRight01Icon} size={14} className="shrink-0" />
            <span className="text-[10px] font-medium leading-none">Go</span>
          </Button>
        </form>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant="bordered"
          radius="md"
          isDisabled={!hasPreviousEpisode}
          onPress={goPreviousEpisode}
          startContent={
            <HugeiconsIcon icon={ArrowLeft01Icon} size={16} className="shrink-0" />
          }
        >
          Previous episode
        </Button>
        <Button
          size="sm"
          variant="bordered"
          radius="md"
          isDisabled={!hasNextEpisode}
          onPress={goNextEpisode}
          endContent={
            <HugeiconsIcon icon={ArrowRight01Icon} size={16} className="shrink-0" />
          }
        >
          Next episode
        </Button>
      </div>

      {showSeasonTabs && releasedSeasons.length > 1 && !flatMode ? (
        <div className="flex flex-wrap gap-2">
          {releasedSeasons.map((s) => {
            const active = selectedSeason === s.season_number;
            return (
              <Button
                key={s.season_number}
                size="sm"
                radius="lg"
                variant={active ? "solid" : "bordered"}
                color="default"
                className={
                  active
                    ? "border-2 border-foreground bg-transparent font-medium text-foreground"
                    : "font-medium text-default-500"
                }
                onPress={() => {
                  onSeasonChange(s.season_number);
                  onEpisodeChange(s.season_number, 1);
                }}
              >
                Season {s.season_number}
              </Button>
            );
          })}
        </div>
      ) : null}

      {loading ? (
        <Carousel opts={{ align: "start", dragFree: true }} className="w-full">
          <CarouselContent className="-ml-3">
            {Array.from({ length: VISIBLE_EPISODE_SLOTS }).map((_, i) => (
              <CarouselItem key={i} className={EPISODE_CAROUSEL_ITEM_CLASS}>
                <div className="h-[168px] w-full animate-pulse rounded-xl bg-default-200" />
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
                    className={`relative flex w-full min-w-0 flex-col overflow-hidden rounded-xl text-left transition-shadow ${
                      active
                        ? "ring-1 ring-default-400/45 dark:ring-default-500/35"
                        : "ring-1 ring-default-200/50 dark:ring-default-100/20"
                    }`}
                  >
                    <div className="relative h-[88px] w-full overflow-hidden bg-default-200/80 dark:bg-default-100/15">
                      {stillUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={stillUrl}
                          alt=""
                          aria-hidden
                          loading="lazy"
                          className="h-full w-full object-cover"
                        />
                      ) : null}
                      <div
                        className={`absolute inset-0 flex items-center justify-center ${
                          stillUrl ? "bg-black/35" : ""
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
                    </div>
                    <div className="flex flex-col gap-1 bg-default-100/90 p-2.5 dark:bg-default-50/10">
                      <span className="text-[11px] font-medium text-default-500">
                        E{padEpisode(labelNum)}
                      </span>
                      <span className="line-clamp-2 text-xs font-semibold leading-snug text-foreground">
                        {row.name}
                      </span>
                      {runtime ? (
                        <span className="inline-flex items-center gap-1 text-[11px] text-default-500">
                          <HugeiconsIcon icon={Clock01Icon} size={12} />
                          {runtime}
                        </span>
                      ) : null}
                    </div>
                    {watched ? (
                      <span
                        className="pointer-events-none absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-success ring-2 ring-background"
                        aria-hidden
                      />
                    ) : null}
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
