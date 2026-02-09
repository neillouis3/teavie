'use client';

import React from "react";
import Link from "next/link";

type LargeCardProps = {
  id: number;
  title: string;
  year: string | number;
  runtime?: number;
  seasonAmount?: number;
  type: "movie" | "tv";
  posterPath?: string;
  backdropPath?: string;
};

export default function LargeCard({
  id,
  title,
  year,
  runtime,
  seasonAmount,
  type,
  posterPath,
  backdropPath,
}: LargeCardProps) {
  const baseUrl = "https://image.tmdb.org/t/p/";
  const backdropSize = "w1280"; // nice for hero cards
  const posterSize = "w500";

  // Prefer backdrop image, fallback to poster
  const imageUrl = backdropPath
    ? `${baseUrl}${backdropSize}${backdropPath}`
    : posterPath
    ? `${baseUrl}${posterSize}${posterPath}`
    : "/placeholder.jpg";

  const href = type === "tv" ? `/shows/${id}` : `/movies/${id}`;

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
          <h1 className="text-3xl font-bold group-hover:text-[#21D5E0] transition-colors">
            {title}
          </h1>
          <p className="text-sm text-gray-300">
            {type === "tv"
              ? `TV Show • ${year} • SS ${seasonAmount ?? "?"}`
              : `Movie • ${year} • ${runtime ?? "?"} min`}
          </p>
        </div>
      </div>
    </Link>
  );
}
