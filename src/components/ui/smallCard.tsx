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
  const href = type === "show" ? `/shows/${id}` : `/movies/${id}`;

  return (
    <div className="w-fit h-96 flex flex-col rounded-xl group ">
      <Link href={href}>
        <div className="w-fit flex-1 h-72 relative">
          <Image
            src={imageUrl}
            alt={title}
            className="w-full h-72 rounded-xl transition-all duration-300 group-hover:opacity-50"
          />
          
        </div>
      </Link>

      <div className="rounded-b-xl flex-1 text-gray-500 w-full h-[20%] group pt-2">
        <div className="w-full flex flex-row justify-between items-center">
          <p className="flex-1 text-xs text-start">{year}</p>
          <div className="flex-1 text-xs text-center justify-center border border-gray-500 group-hover:border-success rounded-2xl w-fit group-hover:text-success transition-colors duration-300">
            {type === "show" ? "TV" : type === "movie" ? "Movie" : type}
          </div>
          <p className="flex-1 text-xs text-end">
            {type === "show"
              ? `SS ${seasonAmount}`
              : type === "movie"
              ? `${runtime} min`
              : ""}
          </p>
        </div>
        <div className="w-full ">
            <h1 className="text-md group-hover:text-success transition-colors duration-300">
                {title.length > 25 ? title.slice(0, title.length / 1.5) + "..." : title}
            </h1>
            </div>


       

      </div>
    </div>
  );
}
