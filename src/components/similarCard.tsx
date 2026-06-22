'use client'

import React from "react";
import Link from "next/link";
import { Image } from "@heroui/react";
import { tmdbImageUrlOr } from "@/lib/tmdbImage";

interface SimilarCardProps {
  title: string;
  year: string; // ✅ make this a string
  type: "movie" | "tv" | string;
  runtimeSeconds?: number;
  seasonAmount?: number;
  numberOfEpisodes?: number | null;
  id: number | string;
  backDropPath?: string;
}

export default function SimilarCard({
  title,
  year,
  type,
  runtimeSeconds,
  seasonAmount,
  numberOfEpisodes,
  id,
  backDropPath,
}: SimilarCardProps) {
  const runtimeMin = runtimeSeconds != null ? Math.round(runtimeSeconds / 60) : null;

  const imageUrl = tmdbImageUrlOr(backDropPath, "/fallback.jpg");

  return (
    <Link href={type === 'tv' ? `/shows/${id}` : `/movies/${id}`}>
      <div className="w-full h-20 bg-background drop-shadow-md bg-opacity-50 flex flex-row group rounded-lg">
        <div className="h-20">
          <Image
            src={imageUrl}
            alt={title}
            radius="none"
            className="h-20 object-cover rounded-l-lg"
          />
        </div>
        <div className="flex min-w-0 w-full flex-col justify-between rounded-r-lg px-3 py-2 group-hover:bg-success transition-colors duration-300 sm:px-4">
          <div className="h-fit min-w-0">
            <h1 className="truncate text-xs text-gray-500 group-hover:text-main">
                {type === 'tv'
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
                    return `TV show / ${year} / ${meta}`;
                  })()
                : `Movie / ${year} / ${runtimeMin ?? "-"} min`}
            </h1>

          </div>
          <div className="flex h-full min-w-0 flex-col justify-center">
            <h1 className="line-clamp-2 text-sm group-hover:text-main sm:text-base">{title}</h1>
          </div>
        </div>
      </div>
    </Link>
  );
}
