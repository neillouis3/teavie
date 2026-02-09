import React from "react";
import Link from "next/link";
import { Image } from "@heroui/react";

interface SmallCardProps {
  id: number;
  title: string;
  year: string; // <-- changed to string
  runtime: number;
  seasonAmount: number;
  type: string;
  posterPath: string;
}

export default function SmallCard({
  id,
  title,
  year,
  runtime,
  seasonAmount,
  type,
  posterPath,
}: SmallCardProps) {
  const baseUrl = "https://image.tmdb.org/t/p/";
  const size = "w500";
  const imageUrl = `${baseUrl}${size}${posterPath}`;
  const href = type === "tv" ? `/shows/${id}` : `/movies/${id}`;

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
            {type === "TV" ? "TV" : type === "Movie" ? "Movie" : type}
          </div>
          <p className="flex-1 text-xs text-end truncate">
            {type === "TV"
              ? `SS ${seasonAmount}`
              : type === "Movie"
              ? `${runtime} min`
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
