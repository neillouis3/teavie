"use client";

import React from "react";
import { Image } from "@heroui/react";
import { HugeiconsIcon } from "@hugeicons/react";
import { StarIcon } from "@hugeicons/core-free-icons";
import CatalogDetailColumns, {
  type CatalogDetailLink,
  type CatalogGenre,
  type CatalogInfoLine,
} from "./catalogDetailColumns";

export type CatalogMediaPanelProps = {
  posterUrl: string;
  posterAlt: string;
  title: string;
  subtitleLine: string;
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
};

const DETAIL_META_CARD =
  "w-full overflow-hidden rounded-xl border border-solid border-default-200/55 dark:border-default-100/35";

const DETAIL_META_CARD_INNER =
  "bg-default-50 px-4 py-5 dark:bg-default-50/10 sm:px-6 sm:py-6";

function formatStatusDisplay(
  status: string | null | undefined
): { label: string; active: boolean } | null {
  const raw = String(status ?? "").trim();
  if (!raw) return null;
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
  subtitleLine,
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
}: CatalogMediaPanelProps) {
  const ratingLabel =
    rating != null && Number.isFinite(rating) ? `${rating.toFixed(1)} / 10` : null;
  const statusDisplay = formatStatusDisplay(status);

  return (
    <div className="w-full space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:gap-5">
        <div className="mx-auto w-28 shrink-0 sm:mx-0 sm:w-32 md:w-36 lg:w-40">
          {posterUrl ? (
            <Image
              src={posterUrl}
              alt={posterAlt}
              className="aspect-[2/3] w-full rounded-lg object-cover ring-1 ring-default-200/35 dark:ring-default-100/15"
            />
          ) : (
            <div className="aspect-[2/3] w-full rounded-lg bg-default-200/80 ring-1 ring-default-200/35 dark:bg-default-100/20 dark:ring-default-100/15" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            {title}
          </h1>
          <p className="mt-1.5 text-sm text-default-500">{subtitleLine}</p>
          {(ratingLabel || certification || statusDisplay) && (
            <div className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
              {ratingLabel ? (
                <span className="inline-flex items-center gap-1 text-foreground">
                  <HugeiconsIcon
                    icon={StarIcon}
                    size={15}
                    className="text-warning"
                  />
                  {ratingLabel}
                </span>
              ) : null}
              {ratingLabel && (certification || statusDisplay) ? <MetaDot /> : null}
              {certification ? (
                <span className="rounded border border-default-400/60 px-1.5 py-0.5 text-xs font-medium text-foreground/90">
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
          )}
          <p className="mt-4 text-sm leading-relaxed text-foreground/85 sm:mt-5 sm:text-[15px]">
            {overview?.trim() ? overview : "No overview available."}
          </p>
          {tagline?.trim() ? (
            <p className="mt-2 text-sm italic text-default-500">
              &ldquo;{tagline.trim()}&rdquo;
            </p>
          ) : null}
        </div>
      </div>

      {seasonEpisodeSection ? (
        <div className="space-y-4">{seasonEpisodeSection}</div>
      ) : null}

      <section className={DETAIL_META_CARD}>
        <div className={DETAIL_META_CARD_INNER}>
          <CatalogDetailColumns
            mediaType={mediaType}
            genres={genres}
            infoLines={infoLines}
            links={links}
            genreBrowseBase={genreBrowseBase}
          />
        </div>
      </section>
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
      <div className="flex flex-col gap-4 sm:flex-row sm:gap-5">
        <div className="mx-auto aspect-[2/3] w-28 shrink-0 animate-pulse rounded-lg bg-default-200 sm:mx-0 sm:w-32 md:w-36" />
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
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 sm:gap-x-4 sm:gap-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="space-y-2">
                <div className="h-3 w-16 animate-pulse rounded bg-default-200" />
                <div className="h-6 w-24 animate-pulse rounded-full bg-default-200" />
                <div className="h-6 w-28 animate-pulse rounded-full bg-default-200" />
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
