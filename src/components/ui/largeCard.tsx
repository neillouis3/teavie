'use client';

import React from "react";
import Link from "next/link";
import { formatReleasePhrase } from "@/lib/formatRelease";

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
};

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
}: LargeCardProps) {
  const typeLower = (type ?? "").toLowerCase();
  const runtimeMin = runtimeSeconds != null ? Math.round(runtimeSeconds / 60) : null;
  const baseUrl = "https://image.tmdb.org/t/p/";
  const backdropSize = "w1280";
  const posterSize = "w500";

  const imageUrl = backdropPath
    ? /^https?:\/\//i.test(backdropPath)
      ? backdropPath
      : `${baseUrl}${backdropSize}${backdropPath}`
    : posterPath
      ? /^https?:\/\//i.test(posterPath)
        ? posterPath
        : `${baseUrl}${posterSize}${posterPath}`
      : "/placeholder.jpg";

  const href = typeLower === "tv" ? `/shows/${id}` : `/movies/${id}`;
  const when =
    releaseDate != null && String(releaseDate).trim().length >= 10
      ? formatReleasePhrase(releaseDate)
      : null;

  return (
    <Link href={href} className="block min-w-0 w-full">
      <div className="group relative aspect-video w-full overflow-hidden rounded-xl">
        <img
          src={imageUrl}
          alt={title}
          className="h-full w-full object-cover transition-all duration-500 group-hover:scale-105"
        />
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
                  return `TV Show • ${when ?? year} • ${meta}`;
                })()
              : `Movie • ${when ?? year} • ${runtimeMin != null ? `${runtimeMin} min` : "—"}`}
          </p>
        </div>
      </div>
    </Link>
  );
}
