'use client'

import React from "react";
import Link from "next/link";
import { Image } from "@heroui/react";

interface SimilarCardProps {
  title: string;
  year: string; // ✅ make this a string
  type: "movie" | "tv" | string;
  runtime?: number;
  seasonAmount?: number;
  id: number;
  backDropPath?: string;
}

export default function SimilarCard({
  title,
  year,
  type,
  runtime,
  seasonAmount,
  id,
  backDropPath,
}: SimilarCardProps) {
  const baseUrl = 'https://image.tmdb.org/t/p/';
  const size = 'w500';

  const imageUrl = backDropPath ? `${baseUrl}${size}${backDropPath}` : "/fallback.jpg"; // add fallback

  return (
    <Link href={type === 'tv' ? `/shows/${id}` : `/movies/${id}`}>
      <div className="w-full h-20 bg-white drop-shadow-md bg-opacity-50 flex flex-row group rounded-lg">
        <div className="h-20">
          <Image
            src={imageUrl}
            alt={title}
            radius="none"
            className="h-20 object-cover rounded-l-lg"
          />
        </div>
        <div className="w-full flex flex-col justify-between rounded-r-lg group-hover:bg-success transition-colors duration-300 px-4 py-2">
          <div className="h-fit">
            <h1 className="text-gray-500 group-hover:text-main text-xs">
                {type === 'tv'
                ? `TV Show / ${year} / SS ${seasonAmount ?? "-"}`
                : `Movie / ${year} / ${runtime ?? "-"} min`}
            </h1>

          </div>
          <div className="h-full flex flex-col justify-center ">
            <h1 className="text-md group-hover:text-main">{title}</h1>
          </div>
          
          
        </div>
      </div>
    </Link>
  );
}
