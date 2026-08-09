"use client";

import React from "react";
import { Image } from "@heroui/react";
import FavoriteStarIcon from "@/components/favorites/FavoriteStarIcon";
import CatalogDetailColumns, {
  CatalogGenreChips,
  type CatalogDetailLink,
  type CatalogGenre,
  type CatalogInfoLine,
} from "./catalogDetailColumns";
import { tmdbImageUrl } from "@/lib/tmdbImage";

export type CatalogMediaPanelProps = {
  posterUrl: string;
  posterAlt: string;
  title: string;
  subtitleLine?: string;
  rating: number | null;
  certification?: string | null;
  status?: string | null;
  overview: string;
  tagline?: string | null;
  seasonEpisodeSection?: React.ReactNode;
  mediaType: "movie" | "tv";
  genres: CatalogGenre[];
  infoLines: CatalogInfoLine[];
  links: CatalogDetailLink[];
  genreBrowseBase?: string;
  toolbar?: React.ReactNode;
  /** Cast, directors, etc. — rendered below genre and other metadata. */
  creditsSection?: React.ReactNode;
  /** Quick facts shown under the title (shows / anime). */
  statPills?: string[];
  /** Alternate titles for anime and localized names. */
  alternateTitles?: string[];
  /** Network / studio tags in the details card. */
  networkTags?: string[];
  /**
   * Watch pages: poster, title, rating, and actions only —
   * no synopsis / genre / details / links.
   */
  compact?: boolean;
  /** TMDB title logo path — shown instead of the text title when set. */
  logoPath?: string | null;
  /** Intercepted desktop modal: backdrop is the artwork, so omit the poster card. */
  hidePosterOnDesktop?: boolean;
};

const DETAIL_META_CARD =
  "w-full overflow-hidden rounded-xl border border-solid border-default-200/55 dark:border-default-100/35";

const DETAIL_META_CARD_INNER =
  "bg-default-50 px-4 py-5 dark:!bg-black/20 sm:px-6 sm:py-6";

function formatStatusDisplay(
  status: string | null | undefined
): { label: string; active: boolean } | null {
  const raw = String(status ?? "").trim();
  if (!raw) return null;
  // Already covered by the subtitle year / release date.
  if (/^released$/i.test(raw)) return null;
  if (/returning/i.test(raw)) return { label: "Returning", active: true };
  if (/production/i.test(raw)) return { label: "In production", active: true };
  return {
    label: raw.replace(/\s*Series\s*$/i, "").trim() || raw,
    active: false,
  };
}

function MetaDot() {
  return (
    <span className="text-default-400" aria-hidden>
      •
    </span>
  );
}

export function formatRuntimeLabel(minutes: number | null | undefined): string | null {
  if (minutes == null || !Number.isFinite(minutes) || minutes <= 0) return null;
  const total = Math.round(minutes);
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m} min`;
}

export function movieSubtitleLine(movie: {
  release_date?: string;
  runtime?: number;
  runtimeSeconds?: number;
}): string {
  const parts = ["Movie"];
  const year = movie.release_date?.slice(0, 4);
  if (year) parts.push(year);
  const mins =
    movie.runtimeSeconds != null
      ? Math.round(movie.runtimeSeconds / 60)
      : movie.runtime;
  const runtime = formatRuntimeLabel(mins ?? null);
  if (runtime) parts.push(runtime);
  return parts.join(" • ");
}

export function showSubtitleLine(show: {
  is_anime?: boolean;
  first_air_date?: string;
  number_of_seasons?: number;
  number_of_episodes?: number;
}): string {
  const parts = [show.is_anime ? "Anime" : "TV show"];
  const year = show.first_air_date?.slice(0, 4);
  if (year) parts.push(year);
  const seasons = show.number_of_seasons;
  if (typeof seasons === "number" && seasons > 0) {
    parts.push(`${seasons} ${seasons === 1 ? "season" : "seasons"}`);
  }
  const episodes = show.number_of_episodes;
  if (typeof episodes === "number" && episodes > 0) {
    parts.push(`${episodes} ${episodes === 1 ? "episode" : "episodes"}`);
  }
  return parts.join(" • ");
}

export default function CatalogMediaPanel({
  posterUrl,
  posterAlt,
  title,
  subtitleLine = "",
  rating,
  certification,
  status,
  overview,
  tagline,
  seasonEpisodeSection,
  mediaType,
  genres,
  infoLines,
  links,
  genreBrowseBase,
  toolbar,
  creditsSection,
  statPills,
  alternateTitles,
  networkTags,
  compact = false,
  logoPath = null,
  hidePosterOnDesktop = false,
}: CatalogMediaPanelProps) {
  const ratingLabel =
    rating != null && Number.isFinite(rating) && rating > 0
      ? `${rating.toFixed(1)} / 10`
      : null;
  const statusDisplay = compact ? null : formatStatusDisplay(status);
  const logoUrl = compact ? null : tmdbImageUrl(logoPath);
  const subtitle = subtitleLine.trim();

  const titleAndStats = (
    <>
      {logoUrl ? (
        <div className="flex h-20 w-full max-w-[16rem] items-end sm:h-24 sm:max-w-[18rem] md:h-28 md:max-w-[20rem]">
          <img
            src={logoUrl}
            alt={title}
            className="max-h-full w-auto max-w-full object-contain object-left-bottom drop-shadow-[0_6px_18px_rgba(0,0,0,0.35)]"
          />
        </div>
      ) : (
        <div
          className={
            compact ? "flex items-end" : "flex h-20 items-end sm:h-24 md:h-28"
          }
        >
          <h1 className="text-2xl !font-normal tracking-tight text-foreground sm:text-3xl">
            {title}
          </h1>
        </div>
      )}
      {subtitle ? (
        <p className="mt-1.5 text-sm text-default-500">{subtitle}</p>
      ) : null}
      {toolbar ? (
        <div
          className={
            hidePosterOnDesktop
              ? "mt-3 lg:mt-14 lg:translate-y-2"
              : "mt-3"
          }
        >
          {toolbar}
        </div>
      ) : null}
      {(ratingLabel || certification || statusDisplay || genres.length > 0) && (
        <div
          className={`flex items-center gap-3 overflow-x-auto text-sm [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${
            compact ? "mt-4" : "mt-8"
          }`}
        >
          {ratingLabel || certification || statusDisplay ? (
            <div className="flex shrink-0 items-center gap-x-2">
              {ratingLabel ? (
                <span className="inline-flex items-center gap-1 text-foreground">
                  <FavoriteStarIcon filled filledColor="#f5b301" size={15} />
                  {ratingLabel}
                </span>
              ) : null}
              {ratingLabel && (certification || statusDisplay) ? <MetaDot /> : null}
              {certification ? (
                <span className="rounded border border-default-400/60 px-1.5 py-0.5 text-sm font-normal text-foreground/90">
                  {certification}
                </span>
              ) : null}
              {certification && statusDisplay ? <MetaDot /> : null}
              {statusDisplay ? (
                <span
                  className={
                    statusDisplay.active
                      ? "font-medium text-success"
                      : "capitalize text-foreground/80"
                  }
                >
                  {statusDisplay.label}
                </span>
              ) : null}
            </div>
          ) : null}
          <CatalogGenreChips
            mediaType={mediaType}
            genres={genres}
            genreBrowseBase={genreBrowseBase}
            className="shrink-0 flex-nowrap"
          />
        </div>
      )}
      {!compact && statPills && statPills.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {statPills.map((pill) => (
            <span
              key={pill}
              className="inline-flex items-center rounded-md border border-default-200/70 bg-default-100/70 px-2.5 py-0.5 text-xs text-foreground dark:border-default-100/25 dark:bg-default-100/10"
            >
              {pill}
            </span>
          ))}
        </div>
      ) : null}
      {!compact && alternateTitles && alternateTitles.length > 0 ? (
        <p className="mt-2.5 text-xs leading-relaxed text-default-500">
          Also known as {alternateTitles.join(" · ")}
        </p>
      ) : null}
    </>
  );

  const overviewBlock = (
    <div className="w-full max-w-[75%]">
      <p className="text-sm leading-relaxed text-foreground/85 dark:text-white">
        {overview?.trim() ? overview : "No overview available."}
      </p>
      {tagline?.trim() ? (
        <p className="mt-2 text-sm italic text-default-500">
          &ldquo;{tagline.trim()}&rdquo;
        </p>
      ) : null}
    </div>
  );

  const posterEl = posterUrl ? (
    <Image
      src={posterUrl}
      alt={posterAlt}
      className="aspect-[2/3] w-full rounded-lg object-cover ring-1 ring-default-200/35 dark:ring-default-100/15"
    />
  ) : (
    <div className="aspect-[2/3] w-full rounded-lg bg-default-200/80 ring-1 ring-default-200/35 dark:bg-default-100/20 dark:ring-default-100/15" />
  );

  if (compact) {
    const synopsis = overview?.trim() || "";
    const quote = tagline?.trim() || "";
    return (
      <div className="w-full">
        <div className="flex gap-4 sm:gap-5">
          <div className="w-28 shrink-0 sm:w-36 md:w-40 lg:w-44">
            {posterEl}
          </div>
          <div className="min-w-0 flex-1">
            {titleAndStats}
            {synopsis || quote ? (
              <div className="mt-4 max-w-3xl space-y-2">
                {synopsis ? (
                  <p className="text-sm leading-relaxed text-foreground/85 sm:text-[15px]">
                    {synopsis}
                  </p>
                ) : null}
                {quote ? (
                  <p className="text-sm italic text-default-500">
                    &ldquo;{quote}&rdquo;
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full space-y-5">
      {/* Mobile: title & stats → poster + description → details */}
      <div className="min-w-0 sm:hidden">{titleAndStats}</div>

      <div className="flex gap-4 sm:hidden">
        <div className="w-28 shrink-0">{posterEl}</div>
        <div className="min-w-0 flex-1 pt-0.5">{overviewBlock}</div>
      </div>

      {/* sm+: poster beside title, stats, and description */}
      <div className="hidden gap-5 sm:flex sm:flex-row">
        <div
          className={`w-32 shrink-0 md:w-36 lg:w-40 ${
            hidePosterOnDesktop ? "lg:hidden" : ""
          }`}
        >
          {posterEl}
        </div>
        <div className="min-w-0 flex-1">
          {titleAndStats}
          <div className="mt-4 sm:mt-5">{overviewBlock}</div>
        </div>
      </div>

      {seasonEpisodeSection ? (
        <div className="space-y-4">{seasonEpisodeSection}</div>
      ) : null}

      <section className={DETAIL_META_CARD}>
        <div className={DETAIL_META_CARD_INNER}>
          <CatalogDetailColumns
            infoLines={infoLines}
            links={links}
            networkTags={networkTags}
          />
        </div>
      </section>

      {creditsSection ? (
        <section className="w-full" aria-label="Cast and crew">
          {creditsSection}
        </section>
      ) : null}
    </div>
  );
}

export function CatalogMediaPanelSkeleton({
  withSeasonPicker = false,
}: {
  withSeasonPicker?: boolean;
}) {
  return (
    <div className="w-full space-y-5">
      <div className="space-y-3 sm:hidden">
        <div className="h-8 w-3/4 max-w-xl animate-pulse rounded-lg bg-default-200" />
        <div className="h-4 w-48 animate-pulse rounded bg-default-200" />
        <div className="h-4 w-56 animate-pulse rounded bg-default-200" />
      </div>

      <div className="flex gap-4 sm:hidden">
        <div className="aspect-[2/3] w-28 shrink-0 animate-pulse rounded-lg bg-default-200" />
        <div className="min-w-0 flex-1 space-y-2 pt-0.5">
          {[90, 75, 55].map((w, i) => (
            <div
              key={i}
              className="h-3 animate-pulse rounded bg-default-200"
              style={{ width: `${w}%` }}
            />
          ))}
        </div>
      </div>

      <div className="hidden gap-5 sm:flex sm:flex-row">
        <div className="aspect-[2/3] w-32 shrink-0 animate-pulse rounded-lg bg-default-200 md:w-36" />
        <div className="min-w-0 flex-1 space-y-3">
          <div className="h-8 w-3/4 max-w-xl animate-pulse rounded-lg bg-default-200 sm:h-9" />
          <div className="h-4 w-48 animate-pulse rounded bg-default-200" />
          <div className="h-4 w-56 animate-pulse rounded bg-default-200" />
          <div className="space-y-2 pt-1">
            {[90, 75, 55].map((w, i) => (
              <div
                key={i}
                className="h-3 animate-pulse rounded bg-default-200"
                style={{ width: `${w}%` }}
              />
            ))}
          </div>
        </div>
      </div>
      {withSeasonPicker ? (
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="h-3 w-12 animate-pulse rounded bg-default-200" />
            <div className="flex flex-wrap gap-2">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-9 w-9 animate-pulse rounded-full bg-default-200"
                />
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <div className="h-3 w-14 animate-pulse rounded bg-default-200" />
            <div className="flex flex-wrap gap-2">
              {Array.from({ length: 10 }).map((_, i) => (
                <div
                  key={i}
                  className="h-9 w-9 animate-pulse rounded-full bg-default-200"
                />
              ))}
            </div>
          </div>
        </div>
      ) : null}
      <section className={DETAIL_META_CARD}>
        <div className={DETAIL_META_CARD_INNER}>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-8">
            <div className="min-w-0 flex-[2] space-y-2">
              <div className="h-3 w-16 animate-pulse rounded bg-default-200" />
              <div className="h-6 w-32 animate-pulse rounded bg-default-200" />
              <div className="h-6 w-28 animate-pulse rounded bg-default-200" />
            </div>
            <div className="min-w-0 flex-1 space-y-2">
              <div className="h-3 w-16 animate-pulse rounded bg-default-200" />
              <div className="h-6 w-24 animate-pulse rounded-full bg-default-200" />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
