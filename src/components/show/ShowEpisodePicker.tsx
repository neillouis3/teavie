"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Button, Input } from "@heroui/react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
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
  /** 1-based cumulative index when flatMode */
  displayNumber?: number;
};

type ShowEpisodePickerProps = {
  showTitle: string;
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
    }) => ({
      season: seasonNum,
      episode: ep.episode_number,
      name: ep.name,
      runtime: ep.runtime,
    })
  );
}

export default function ShowEpisodePicker({
  showTitle,
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

  const seasonTabClass = (active: boolean) =>
    active
      ? "border-2 border-foreground bg-transparent text-foreground"
      : "border border-default-300/60 bg-transparent text-default-500 hover:text-foreground dark:border-default-100/25";

  return (
    <section className="flex w-full flex-col gap-4" aria-label="Episodes">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <h2 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
          {showTitle}
        </h2>

        <div className="flex shrink-0 items-end gap-2 rounded-xl border border-default-200/60 bg-default-100/40 p-2 dark:border-default-100/20 dark:bg-default-100/10">
          <Input
            size="sm"
            type="number"
            min={1}
            label="S"
            labelPlacement="outside-left"
            aria-label="Season"
            value={jumpSeason}
            onValueChange={setJumpSeason}
            classNames={{
              base: "max-w-[88px]",
              input: "text-sm tabular-nums",
              inputWrapper: "h-9 min-h-9 bg-default-100 dark:bg-default-50/10",
              label: "text-xs text-default-500",
            }}
          />
          <Input
            size="sm"
            type="number"
            min={1}
            label="E"
            labelPlacement="outside-left"
            aria-label="Episode"
            value={jumpEpisode}
            onValueChange={setJumpEpisode}
            classNames={{
              base: "max-w-[88px]",
              input: "text-sm tabular-nums",
              inputWrapper: "h-9 min-h-9 bg-default-100 dark:bg-default-50/10",
              label: "text-xs text-default-500",
            }}
          />
          <Button
            size="sm"
            variant="flat"
            className="h-9 min-w-[52px] flex-col gap-0 px-2"
            onPress={handleJump}
          >
            <HugeiconsIcon icon={ArrowRight01Icon} size={14} className="shrink-0" />
            <span className="text-[10px] font-medium leading-none">Go</span>
          </Button>
        </div>
      </div>

      {showSeasonTabs && releasedSeasons.length > 1 && !flatMode ? (
        <div className="flex flex-wrap gap-2">
          {releasedSeasons.map((s) => {
            const active = selectedSeason === s.season_number;
            return (
              <button
                key={s.season_number}
                type="button"
                onClick={() => {
                  onSeasonChange(s.season_number);
                  onEpisodeChange(s.season_number, 1);
                }}
                className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${seasonTabClass(active)}`}
              >
                Season {s.season_number}
              </button>
            );
          })}
        </div>
      ) : null}

      {loading ? (
        <div className="flex gap-3 overflow-hidden py-1">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="h-[168px] w-[132px] shrink-0 animate-pulse rounded-xl bg-default-200"
            />
          ))}
        </div>
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

              return (
                <CarouselItem
                  key={`${row.season}-${row.episode}-${row.displayNumber ?? ""}`}
                  className="basis-auto pl-3"
                >
                  <button
                    type="button"
                    onClick={() => handleSelect(row)}
                    aria-label={`Episode ${labelNum}: ${row.name}${watched ? ", watched" : ""}`}
                    aria-current={active ? "true" : undefined}
                    className={`relative flex w-[132px] flex-col overflow-hidden rounded-xl text-left transition-shadow ${
                      active
                        ? "ring-2 ring-foreground ring-offset-2 ring-offset-background"
                        : "ring-1 ring-default-200/50 dark:ring-default-100/20"
                    }`}
                  >
                    <div className="flex h-[88px] items-center justify-center bg-default-200/80 dark:bg-default-100/15">
                      <HugeiconsIcon
                        icon={PlayIcon}
                        size={28}
                        className="text-secondary"
                      />
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
