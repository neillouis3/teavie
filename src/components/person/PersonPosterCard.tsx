"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { HugeiconsIcon } from "@hugeicons/react";
import { SquareLock01Icon } from "@hugeicons/core-free-icons";
import { catalogDisplayTitle } from "@/lib/catalogDisplayTitle";
import { catalogTodayIsoUtc } from "@/lib/catalogQuery";
import { formatHeroDate } from "@/lib/formatRelease";
import { tmdbGridPosterUrl } from "@/lib/tmdbImage";
import FavoriteStarIcon from "@/components/favorites/FavoriteStarIcon";
import type { ContentItem } from "@/types/content";

export type PersonCreditItem = ContentItem & {
  character?: string | null;
};

type PersonPosterCardProps = {
  item: PersonCreditItem;
  variant?: "knownFor" | "filmography";
  priority?: boolean;
};

function itemYear(item: PersonCreditItem) {
  const raw = item.release_date ?? "";
  return raw.length >= 4 ? raw.slice(0, 4) : "—";
}

function isUnreleased(releaseDate?: string | null) {
  if (!releaseDate || releaseDate.length < 10) return false;
  return releaseDate.slice(0, 10) > catalogTodayIsoUtc();
}

export default function PersonPosterCard({
  item,
  variant = "filmography",
  priority = false,
}: PersonPosterCardProps) {
  const typeLower = (item.type ?? "movie").toLowerCase();
  const href = typeLower === "tv" ? `/shows/${item.id}` : `/movies/${item.id}`;
  const title = catalogDisplayTitle(item.title ?? item.name ?? "Untitled");
  const year = itemYear(item);
  const posterPath = item.poster_path ?? "";
  const hasPoster = Boolean(posterPath.trim());
  const imageUrl = tmdbGridPosterUrl(posterPath);
  const unreleased = isUnreleased(item.release_date);
  const releaseLabel = unreleased ? formatHeroDate(item.release_date) : null;
  const ratingLabel =
    typeof item.vote_average === "number" &&
    Number.isFinite(item.vote_average) &&
    item.vote_average > 0
      ? item.vote_average.toFixed(1)
      : null;

  return (
    <Link
      href={href}
      prefetch={false}
      className="group relative block min-w-0"
      aria-label={`${title}${year !== "—" ? `, ${year}` : ""}`}
    >
      <div className="relative aspect-[2/3] w-full overflow-hidden rounded-2xl bg-[#141414]">
        {hasPoster ? (
          <Image
            src={imageUrl}
            alt={title}
            fill
            unoptimized
            priority={priority}
            sizes="(max-width: 640px) 30vw, (max-width: 1024px) 18vw, 140px"
            className={`object-cover transition duration-300 ${
              unreleased ? "brightness-[0.35]" : "group-hover:brightness-90"
            }`}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center px-3 py-4 text-center">
            <p className="line-clamp-4 text-sm leading-snug text-white/45">{title}</p>
          </div>
        )}

        {unreleased ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 px-2 text-center text-white">
            <HugeiconsIcon icon={SquareLock01Icon} size={22} strokeWidth={1.75} />
            <span className="text-xs font-medium">Unreleased</span>
            {releaseLabel ? (
              <span className="text-xs text-white/70">{releaseLabel}</span>
            ) : null}
          </div>
        ) : null}

        {variant === "filmography" && !unreleased ? (
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/55 to-transparent px-2.5 pb-2.5 pt-10 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
            <p className="line-clamp-2 text-sm font-semibold leading-snug text-white">
              {title}
            </p>
            <div className="mt-1 flex items-center justify-between gap-2 text-xs text-white/75">
              <span>{year !== "—" ? year : "—"}</span>
              {ratingLabel ? (
                <span className="inline-flex items-center gap-1 text-warning">
                  <FavoriteStarIcon filled filledColor="#f5b301" size={14} />
                  {ratingLabel}
                </span>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </Link>
  );
}
