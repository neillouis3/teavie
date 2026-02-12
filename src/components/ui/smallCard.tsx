import React from "react";
import Link from "next/link";
import { Image } from "@heroui/react";

interface SmallCardProps {
  id: number;
  title: string;
  year: string;
  runtimeSeconds?: number;
  seasonAmount: number;
  type: string;
  posterPath: string;
}

export default function SmallCard({
  id,
  title,
  year,
  runtimeSeconds,
  seasonAmount,
  type,
  posterPath,
}: SmallCardProps) {
  const typeLower = (type ?? "").toLowerCase();
  const runtimeMin = runtimeSeconds != null ? Math.round(runtimeSeconds / 60) : null;
  const baseUrl = "https://image.tmdb.org/t/p/";
  const size = "w500";
  const imageUrl = `${baseUrl}${size}${posterPath}`;
  const href = typeLower === "tv" ? `/shows/${id}` : `/movies/${id}`;

  return (
    <div className="w-full min-w-0 h-96 flex flex-col rounded-xl group">
      <Link href={href} className="block w-full shrink-0">
        <div className="w-full h-72 relative overflow-hidden rounded-xl">
          <Image
            src={imageUrl}
            alt={title}
            className="w-full h-full object-cover transition-all duration-300 group-hover:opacity-50"
          />
        </div>
      </Link>

      <div className="rounded-b-xl text-gray-500 w-full min-w-0 flex flex-col gap-1 pt-2 flex-1 min-h-0">
        <div className="w-full flex flex-row justify-between items-center gap-1 shrink-0">
          <p className="flex-1 text-xs text-start truncate">{year}</p>
          <div className="uppercase flex-shrink-0 text-xs text-center border border-gray-500 group-hover:border-success rounded-2xl px-2 py-0.5 group-hover:text-success transition-colors duration-300">
            {typeLower === "tv" ? "TV" : typeLower === "movie" ? "Movie" : type}
          </div>
          <p className="flex-1 text-xs text-end truncate">
            {typeLower === "tv"
              ? (seasonAmount != null && seasonAmount > 0 ? `SS ${seasonAmount}` : "—")
              : typeLower === "movie"
              ? runtimeMin != null ? `${runtimeMin} min` : "—"
              : ""}
          </p>
        </div>
        <h1 className="text-md group-hover:text-success transition-colors duration-300 truncate min-h-0" title={title}>
          {title.length > 25 ? title.slice(0, title.length / 1.5) + "..." : title}
        </h1>
      </div>
    </div>
  );
}
