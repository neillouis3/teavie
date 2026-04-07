'use client';

import React from "react";
import Link from "next/link";

type LargeCardProps = {
  id: number;
  title: string;
  year: string | number;
  runtimeSeconds?: number;
  seasonAmount?: number;
  type: "movie" | "tv";
  posterPath?: string;
  backdropPath?: string;
};

export default function LargeCard({
  id,
  title,
  year,
  runtimeSeconds,
  seasonAmount,
  type,
  posterPath,
  backdropPath,
}: LargeCardProps) {
  const typeLower = (type ?? "").toLowerCase();
  const runtimeMin = runtimeSeconds != null ? Math.round(runtimeSeconds / 60) : null;
  const baseUrl = "https://image.tmdb.org/t/p/";
  const backdropSize = "w1280"; // nice for hero cards
  const posterSize = "w500";

  // Prefer backdrop image, fallback to poster
  const imageUrl = backdropPath
    ? `${baseUrl}${backdropSize}${backdropPath}`
    : posterPath
    ? `${baseUrl}${posterSize}${posterPath}`
    : "/placeholder.jpg";

  const href = typeLower === "tv" ? `/shows/${id}` : `/movies/${id}`;

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
              ? `TV Show • ${year} • SS ${seasonAmount ?? "?"}`
              : `Movie • ${year} • ${runtimeMin != null ? `${runtimeMin} min` : "—"}`}
          </p>
        </div>
      </div>
    </Link>
  );
}
