"use client";

import React, { useMemo, useState } from "react";
import Image from "next/image";
import { HugeiconsIcon } from "@hugeicons/react";
import { Search01Icon } from "@hugeicons/core-free-icons";
import { useEpisodePicker } from "@/components/show/ShowEpisodePicker";
import { formatRuntimeLabel } from "@/components/ui/catalogMediaPanel";
import { isEpisodeUpcoming } from "@/lib/episodeRelease";
import { tmdbImageUrl } from "@/lib/tmdbImage";
import { formatWatchEpKey } from "@/lib/watchProgress";

type ShowEpisodesGridProps = {
  title: string;
  logoPath?: string | null;
  year?: string | null;
  certification?: string | null;
  overview?: string | null;
};

function episodeStillFallbackClass(season: number, episode: number): string {
  const palettes = [
    "from-violet-500/40 via-indigo-400/20 to-zinc-900",
    "from-sky-500/40 via-cyan-400/20 to-zinc-900",
    "from-emerald-500/40 via-teal-400/20 to-zinc-900",
    "from-amber-500/35 via-orange-400/15 to-zinc-900",
    "from-rose-500/35 via-pink-400/15 to-zinc-900",
  ];
  const idx = (season * 31 + episode) % palettes.length;
  return `bg-gradient-to-br ${palettes[idx]}`;
}

function formatEpisodeAirDateLong(airDate?: string | null): string | null {
  const ad = String(airDate ?? "").trim();
  if (ad.length < 10) return null;
  try {
    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(new Date(`${ad.slice(0, 10)}T12:00:00`));
  } catch {
    return ad.slice(0, 10);
  }
}

function EpisodeGridSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className="flex flex-col" aria-hidden>
          <div className="aspect-video w-full animate-pulse rounded-2xl bg-white/5" />
          <div className="mt-3 h-3 w-28 animate-pulse rounded bg-white/5" />
          <div className="mt-2 h-5 w-3/4 animate-pulse rounded bg-white/5" />
          <div className="mt-3 space-y-2">
            <div className="h-3 w-full animate-pulse rounded bg-white/5" />
            <div className="h-3 w-full animate-pulse rounded bg-white/5" />
            <div className="h-3 w-2/3 animate-pulse rounded bg-white/5" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function ShowEpisodesGrid({
  title,
  logoPath = null,
  year = null,
  certification = null,
  overview = null,
}: ShowEpisodesGridProps) {
  const {
    releasedSeasons,
    displayedEpisodes,
    loading,
    error,
    showSeasonTabs,
    flatMode,
    selectedSeason,
    fallbackStillPath,
    watchedKeys,
    onSeasonChange,
    onEpisodeChange,
    handleSelect,
  } = useEpisodePicker();

  const [unwatchedOnly, setUnwatchedOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const logoUrl = tmdbImageUrl(logoPath);
  const seasonCount = releasedSeasons.length;

  const metaParts = [
    year?.trim() || null,
    certification?.trim() || null,
    seasonCount > 0
      ? `${seasonCount} Season${seasonCount === 1 ? "" : "s"}`
      : null,
  ].filter(Boolean);

  const filteredEpisodes = useMemo(() => {
    let rows = displayedEpisodes.filter((row) => !isEpisodeUpcoming(row.air_date));
    if (unwatchedOnly) {
      const watched = watchedKeys ?? new Set<string>();
      rows = rows.filter(
        (row) => !watched.has(formatWatchEpKey(row.season, row.episode))
      );
    }
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      rows = rows.filter(
        (row) =>
          row.name.toLowerCase().includes(q) ||
          (row.overview ?? "").toLowerCase().includes(q)
      );
    }
    return rows;
  }, [displayedEpisodes, unwatchedOnly, watchedKeys, searchQuery]);

  const currentSeasonCount =
    releasedSeasons.find((s) => s.season_number === selectedSeason)
      ?.episode_count ?? filteredEpisodes.length;

  const handleSeasonSelect = (seasonNumber: number) => {
    if (seasonNumber === selectedSeason) return;
    onSeasonChange(seasonNumber);
    onEpisodeChange(seasonNumber, 1);
  };

  return (
    <div className="relative w-full">
      <div className="relative mx-auto flex w-full max-w-6xl flex-col px-4 pb-20 pt-20 sm:px-6 lg:px-8 lg:pt-24">
        <header className="mx-auto flex w-full max-w-3xl flex-col items-center text-center">
          {logoUrl ? (
            <div className="mb-6 flex h-24 w-full max-w-md items-end justify-center sm:h-28 md:h-32">
              <img
                src={logoUrl}
                alt={title}
                className="max-h-full w-auto max-w-full object-contain drop-shadow-[0_8px_24px_rgba(0,0,0,0.45)]"
              />
            </div>
          ) : (
            <h1 className="max-w-2xl text-3xl font-bold uppercase tracking-[0.08em] text-white sm:text-4xl md:text-5xl">
              {title}
            </h1>
          )}

          {metaParts.length > 0 ? (
            <p className="mt-4 text-xs font-medium uppercase tracking-[0.14em] text-white/45 sm:text-sm">
              {metaParts.join("   ")}
            </p>
          ) : null}

          {showSeasonTabs && releasedSeasons.length > 1 && !flatMode ? (
            <nav
              className="mt-8 flex flex-wrap items-center justify-center gap-x-5 gap-y-2"
              aria-label="Seasons"
            >
              {releasedSeasons.map((season) => {
                const active = season.season_number === selectedSeason;
                return (
                  <button
                    key={season.season_number}
                    type="button"
                    onClick={() => handleSeasonSelect(season.season_number)}
                    className={`text-sm transition-colors ${
                      active
                        ? "font-medium text-white"
                        : "text-white/40 hover:text-white/70"
                    }`}
                  >
                    Season {season.season_number}
                  </button>
                );
              })}
            </nav>
          ) : null}

          <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => setUnwatchedOnly((prev) => !prev)}
              className={`inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs transition-colors ${
                unwatchedOnly
                  ? "border-white/25 bg-white/10 text-white"
                  : "border-white/10 bg-white/5 text-white/60 hover:border-white/20 hover:text-white/80"
              }`}
            >
              Unwatched
            </button>
            <div className="relative">
              <HugeiconsIcon
                icon={Search01Icon}
                size={15}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/40"
              />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search"
                className="h-8 w-36 rounded-full border border-white/10 bg-white/5 py-0 pl-8 pr-3 text-xs text-white placeholder:text-white/35 focus:border-white/25 focus:outline-none sm:w-44"
              />
            </div>
          </div>
        </header>

        <section className="mt-12 w-full" aria-label="Episodes">
          {loading ? (
            <EpisodeGridSkeleton />
          ) : error ? (
            <p className="text-center text-sm text-white/50">
              Could not load episodes. Try again later.
            </p>
          ) : filteredEpisodes.length === 0 ? (
            <p className="text-center text-sm text-white/50">
              {searchQuery.trim() || unwatchedOnly
                ? "No episodes match your filters."
                : "No episodes available yet."}
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
              {filteredEpisodes.map((row) => {
                const upcoming = isEpisodeUpcoming(row.air_date);
                const stillUrl =
                  tmdbImageUrl(row.still_path) ||
                  tmdbImageUrl(fallbackStillPath);
                const runtime = formatRuntimeLabel(row.runtime);
                const airDate = formatEpisodeAirDateLong(row.air_date);

                return (
                  <button
                    key={`${row.season}-${row.episode}`}
                    type="button"
                    disabled={upcoming}
                    onClick={() => handleSelect(row)}
                    className={`group flex w-full flex-col text-left transition-opacity ${
                      upcoming ? "cursor-not-allowed opacity-60" : "hover:opacity-95"
                    }`}
                  >
                    <div className="relative aspect-video w-full overflow-hidden rounded-2xl bg-zinc-900">
                      {stillUrl ? (
                        <Image
                          src={stillUrl}
                          alt=""
                          fill
                          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                          className="object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                        />
                      ) : (
                        <div
                          className={`absolute inset-0 ${episodeStillFallbackClass(row.season, row.episode)}`}
                          aria-hidden
                        />
                      )}
                    </div>

                    <p className="mt-3 text-xs text-white/45">
                      Season {row.season}, Episode {row.episode}
                    </p>
                    <h3 className="mt-1 text-base font-semibold leading-snug text-white">
                      {row.name}
                    </h3>
                    {row.overview?.trim() ? (
                      <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-white/55">
                        {row.overview}
                      </p>
                    ) : null}
                    <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-white/45">
                      {runtime ? <span>{runtime}</span> : null}
                      {runtime && airDate ? (
                        <span aria-hidden className="text-white/25">
                          ·
                        </span>
                      ) : null}
                      {airDate ? <span>{airDate}</span> : null}
                      {!upcoming ? (
                        <>
                          <span
                            className="rounded border border-white/20 px-1 py-px text-[10px] font-medium uppercase tracking-wide text-white/50"
                            aria-hidden
                          >
                            HD
                          </span>
                          <span
                            className="rounded border border-white/20 px-1 py-px text-[10px] font-medium uppercase tracking-wide text-white/50"
                            aria-hidden
                          >
                            CC
                          </span>
                        </>
                      ) : null}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {overview?.trim() ? (
          <footer className="mx-auto mt-16 w-full max-w-2xl text-center">
            <h2 className="text-lg font-semibold text-white">
              Season {selectedSeason}
            </h2>
            <p className="mt-1 text-sm text-white/45">
              {currentSeasonCount} Episode
              {currentSeasonCount === 1 ? "" : "s"}
            </p>
            <p className="mt-5 text-sm leading-relaxed text-white/55">
              {overview.trim()}
            </p>
          </footer>
        ) : null}
      </div>
    </div>
  );
}
