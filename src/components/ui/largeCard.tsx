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
    <Link href={href}>
      <div className="relative w-full h-[500px] rounded-xl overflow-hidden group">
        <img
          src={imageUrl}
          alt={title}
          className="w-full h-full object-cover transition-all duration-500 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent"></div>
        <div className="absolute bottom-6 left-6 text-white">
          <h1 className="text-3xl font-bold group-hover:text-success transition-colors">
            {title}
          </h1>
          <p className="text-sm text-gray-300">
            {typeLower === "tv"
              ? `TV Show • ${year} • SS ${seasonAmount ?? "?"}`
              : `Movie • ${year} • ${runtimeMin != null ? `${runtimeMin} min` : "—"}`}
          </p>
        </div>
      </div>
    </Link>
  );
}
