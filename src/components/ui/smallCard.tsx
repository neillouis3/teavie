import React from 'react';
import Link from 'next/link';
import { Image } from '@heroui/react';

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
  const typeLower = (type ?? '').toLowerCase();
  const runtimeMin =
    runtimeSeconds != null ? Math.round(runtimeSeconds / 60) : null;
  const baseUrl = 'https://image.tmdb.org/t/p/';
  const size = 'w500';
  const hasPoster = Boolean(posterPath?.trim());
  const imageUrl = hasPoster ? `${baseUrl}${size}${posterPath}` : '';
  const href = typeLower === 'tv' ? `/shows/${id}` : `/movies/${id}`;

  return (
    <div className="group flex min-w-0 w-full flex-col rounded-xl">
      <Link href={href} className="block w-full shrink-0">
        <div className="relative aspect-[2/3] w-full overflow-hidden rounded-xl bg-default-200">
          {hasPoster ? (
            <Image
              src={imageUrl}
              alt={title}
              className="h-full w-full object-cover transition-all duration-300 group-hover:opacity-50"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center px-3 text-center text-xs text-default-500">
              No poster
            </div>
          )}
        </div>
      </Link>

      <div className="mt-2 flex shrink-0 flex-col gap-1 rounded-b-xl text-gray-500">
        <div className="flex w-full flex-row items-center justify-between gap-1">
          <p className="flex-1 truncate text-start text-xs">{year}</p>
          <div className="flex-shrink-0 rounded-2xl border border-gray-500 px-2 py-0.5 text-center text-xs uppercase transition-colors duration-300 group-hover:border-success group-hover:text-success">
            {typeLower === 'tv'
              ? 'TV'
              : typeLower === 'movie'
                ? 'Movie'
                : type}
          </div>
          <p className="flex-1 truncate text-end text-xs">
            {typeLower === 'tv'
              ? seasonAmount != null && seasonAmount > 0
                ? `SS ${seasonAmount}`
                : '—'
              : typeLower === 'movie'
                ? runtimeMin != null
                  ? `${runtimeMin} min`
                  : '—'
                : ''}
          </p>
        </div>
        <h1
          className="text-md truncate transition-colors duration-300 group-hover:text-success"
          title={title}
        >
          {title.length > 25
            ? `${title.slice(0, title.length / 1.5)}...`
            : title}
        </h1>
      </div>
    </div>
  );
}
