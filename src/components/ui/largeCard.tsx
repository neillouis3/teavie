'use client';

import React from "react";
import Link from "next/link";
import { formatHeroDate, formatHeroRuntime, formatReleasePhrase } from "@/lib/formatRelease";
import { preferHighResAnimeImageUrl } from "@/lib/animePoster";
import { tmdbImageUrl, tmdbImageUrlOr } from "@/lib/tmdbImage";
import { cn } from "@/lib/utils";

type LargeCardProps = {
  id: number | string;
  title: string;
  year: string | number;
  /** ISO date (e.g. release_date / first_air_date) for “Releases …” / “Released …” */
  releaseDate?: string | null;
  runtimeSeconds?: number;
  seasonAmount?: number;
  numberOfEpisodes?: number | null;
  type: "movie" | "tv";
  posterPath?: string;
  backdropPath?: string;
  genres?: string[];
  voteAverage?: number | null;
  certification?: string | null;
  overview?: string | null;
  /** Fill parent height (Explore trending hero carousel). */
  hero?: boolean;
  /** Smaller hero overlay type (category featured row). */
  heroCompact?: boolean;
  /** Rich Explore-style overlay on standard aspect-video cards (Discover upcoming). */
  richOverlay?: boolean;
  /** `phrase` = “Releases …”; `short` = “Jun 4, 2026”. */
  releaseDateStyle?: "short" | "phrase";
  /**
   * How the art fills the card. `contain` keeps the source aspect (no crop/zoom) —
   * preferred for anime posters in landscape hero frames.
   */
  imageFit?: "cover" | "contain";
  /** Prefer poster over backdrop (anime covers are usually portrait). */
  preferPoster?: boolean;
  /** TMDB title logo path (official wordmark) for hero overlays. */
  logoPath?: string | null;
};

function MetaDot() {
  return <span className="text-white/35" aria-hidden>·</span>;
}

function CalendarIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      className="shrink-0 text-white"
      aria-hidden
    >
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      className="shrink-0 text-white"
      aria-hidden
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

function StarIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="currentColor"
      className="shrink-0 text-white"
      aria-hidden
    >
      <path d="M12 2.5 14.9 8.4l6.5.9-4.7 4.6 1.1 6.5L12 17.3l-5.8 3.1 1.1-6.5L2.6 9.3l6.5-.9L12 2.5Z" />
    </svg>
  );
}

function HeroCardOverlay({
  title,
  type,
  releaseDate,
  runtimeSeconds,
  seasonAmount,
  numberOfEpisodes,
  genres = [],
  voteAverage,
  certification,
  overview,
  compact = false,
  releaseDateStyle = "short",
  logoPath,
}: {
  title: string;
  type: "movie" | "tv";
  releaseDate?: string | null;
  runtimeSeconds?: number;
  seasonAmount?: number;
  numberOfEpisodes?: number | null;
  genres?: string[];
  voteAverage?: number | null;
  certification?: string | null;
  overview?: string | null;
  compact?: boolean;
  releaseDateStyle?: "short" | "phrase";
  logoPath?: string | null;
}) {
  const dateLabel =
    releaseDateStyle === "phrase"
      ? (() => {
          const phrase = formatReleasePhrase(releaseDate);
          return phrase === "Date TBA" ? null : phrase;
        })()
      : formatHeroDate(releaseDate);
  const runtimeLabel =
    type === "movie"
      ? formatHeroRuntime(runtimeSeconds)
      : (() => {
          const eps =
            typeof numberOfEpisodes === "number" && numberOfEpisodes > 0
              ? numberOfEpisodes
              : null;
          if (eps != null) return `${eps} ep${eps === 1 ? "" : "s"}`;
          if (seasonAmount != null && seasonAmount > 0) {
            return `${seasonAmount} season${seasonAmount === 1 ? "" : "s"}`;
          }
          return null;
        })();
  const ratingLabel =
    typeof voteAverage === "number" && Number.isFinite(voteAverage)
      ? `${voteAverage.toFixed(1)} / 10`
      : null;
  const overviewText = overview?.trim() ?? "";
  const logoUrl = tmdbImageUrl(logoPath);

  return (
    <div
      className={cn(
        "absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/55 to-transparent",
        compact
          ? "px-4 pb-4 pt-16 sm:px-5 sm:pb-5 sm:pt-20"
          : "px-5 pb-8 pt-24 sm:px-8 sm:pb-10 sm:pt-32"
      )}
    >
      <div className="flex max-w-3xl flex-col gap-3">
        {genres.length > 0 ? (
          <div className="flex flex-wrap items-center gap-1.5 text-xs text-white/70 sm:text-sm">
            {genres.slice(0, 2).map((genre) => (
              <span
                key={genre}
                className="rounded-md bg-white/10 px-2 py-0.5 text-inherit text-white/95 backdrop-blur-sm"
              >
                {genre}
              </span>
            ))}
          </div>
        ) : null}

        {logoUrl ? (
          <div
            className={cn(
              "relative w-full max-w-[18rem] sm:max-w-[22rem] md:max-w-[26rem] lg:max-w-[30rem]",
              compact ? "max-w-[14rem] sm:max-w-[18rem]" : null
            )}
          >
            <img
              src={logoUrl}
              alt={title}
              className="h-auto w-full object-contain drop-shadow-[0_8px_24px_rgba(0,0,0,0.55)]"
            />
          </div>
        ) : (
          <h1
            className={`line-clamp-2 font-bold leading-tight text-white ${
              compact
                ? "text-xl sm:text-2xl md:text-3xl"
                : "text-2xl sm:text-3xl md:text-4xl"
            }`}
          >
            {title}
          </h1>
        )}

        {!compact && overviewText ? (
          <p className="w-full min-w-0 text-sm leading-snug text-white/75 line-clamp-2 sm:line-clamp-3">
            {overviewText}
          </p>
        ) : null}

        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-white/70 sm:text-sm">
          {dateLabel && (
            <span className="inline-flex items-center gap-1.5">
              <CalendarIcon />
              {dateLabel}
            </span>
          )}
          {dateLabel && runtimeLabel && <MetaDot />}
          {runtimeLabel && (
            <span className="inline-flex items-center gap-1.5">
              <ClockIcon />
              {runtimeLabel}
            </span>
          )}
          {(dateLabel || runtimeLabel) && ratingLabel && <MetaDot />}
          {ratingLabel && (
            <span className="inline-flex items-center gap-1.5 font-medium text-white">
              <StarIcon />
              {ratingLabel}
            </span>
          )}
          {ratingLabel && certification && <MetaDot />}
          {certification && (
            <span className="rounded border border-white/35 px-1.5 py-0.5 text-[11px] font-medium text-white/90 sm:text-xs">
              {certification}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export default function LargeCard({
  id,
  title,
  year,
  releaseDate,
  runtimeSeconds,
  seasonAmount,
  numberOfEpisodes,
  type,
  posterPath,
  backdropPath,
  genres,
  voteAverage,
  certification,
  overview,
  hero = false,
  heroCompact = false,
  richOverlay = false,
  releaseDateStyle = "short",
  imageFit = "cover",
  preferPoster = false,
  logoPath = null,
}: LargeCardProps) {
  const typeLower = (type ?? "").toLowerCase();
  const runtimeMin = runtimeSeconds != null ? Math.round(runtimeSeconds / 60) : null;
  const showRichOverlay = hero || richOverlay;
  const contain = imageFit === "contain";

  const primaryPath = preferPoster
    ? tmdbImageUrlOr(posterPath, tmdbImageUrlOr(backdropPath, ""))
    : tmdbImageUrlOr(backdropPath, tmdbImageUrlOr(posterPath, ""));
  const imageUrl =
    preferHighResAnimeImageUrl(primaryPath) ||
    primaryPath ||
    "/placeholder.jpg";

  const href = typeLower === "tv" ? `/shows/${id}` : `/movies/${id}`;
  const when =
    releaseDate != null && String(releaseDate).trim().length >= 10
      ? formatReleasePhrase(releaseDate)
      : null;

  return (
    <Link href={href} className={`block h-full w-full ${hero ? "" : "min-w-0"}`}>
      <div
        className={`group relative h-full w-full max-w-none overflow-hidden ${
          hero ? "min-h-[280px] rounded-none" : "aspect-video min-w-0 rounded-xl"
        } ${contain ? "bg-black" : ""}`}
      >
        <img
          src={imageUrl}
          alt={title}
          className={cn(
            "h-full w-full transition-all duration-500",
            contain ? "object-contain" : "object-cover group-hover:scale-105",
            hero && "absolute inset-0"
          )}
        />
        {!showRichOverlay && (
          <>
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
            <div className="absolute bottom-4 left-4 right-4 text-white sm:bottom-6 sm:left-6 sm:right-auto">
              <h1 className="line-clamp-2 text-xl font-bold transition-colors group-hover:text-success sm:text-2xl md:text-3xl">
                {title}
              </h1>
              <p className="mt-1 text-xs text-gray-300 sm:text-sm">
                {typeLower === "tv"
                  ? (() => {
                      const eps =
                        typeof numberOfEpisodes === "number" && numberOfEpisodes > 0
                          ? numberOfEpisodes
                          : null;
                      const meta =
                        eps != null
                          ? `${eps} ep${eps === 1 ? "" : "s"}`
                          : seasonAmount != null && seasonAmount > 0
                            ? `${seasonAmount} season${seasonAmount === 1 ? "" : "s"}`
                            : "—";
                      return `TV show • ${when ?? year} • ${meta}`;
                    })()
                  : `Movie • ${when ?? year} • ${runtimeMin != null ? `${runtimeMin} min` : "—"}`}
              </p>
            </div>
          </>
        )}
        {showRichOverlay && (
          <HeroCardOverlay
            title={title}
            type={type}
            releaseDate={releaseDate}
            runtimeSeconds={runtimeSeconds}
            seasonAmount={seasonAmount}
            numberOfEpisodes={numberOfEpisodes}
            genres={genres}
            voteAverage={voteAverage}
            certification={certification}
            overview={overview}
            compact={!hero || heroCompact}
            releaseDateStyle={releaseDateStyle}
            logoPath={logoPath}
          />
        )}
      </div>
    </Link>
  );
}
