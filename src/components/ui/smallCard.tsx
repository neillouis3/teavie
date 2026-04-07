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
    <div className="group flex min-h-0 min-w-0 w-full flex-col rounded-xl">
      <Link href={href} className="block w-full shrink-0" aria-label={title}>
        <div className="relative h-72 w-full overflow-hidden rounded-xl bg-default-200">
          {hasPoster ? (
            <Image
              src={imageUrl}
              alt=""
              aria-hidden
              className="h-full w-full object-cover transition-all duration-300 group-hover:opacity-90"
            />
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center gap-2 px-3 text-center">
              <p className="text-sm font-semibold text-foreground line-clamp-3">
                {title}
              </p>
              <span className="text-xs text-default-500">No poster</span>
            </div>
          )}
          {hasPoster && (
            <>
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 px-2.5 pb-2.5 pt-10">
                <p className="text-sm font-semibold leading-snug text-white drop-shadow-md line-clamp-2">
                  {title}
                </p>
              </div>
            </>
          )}
        </div>
      </Link>

      <div className="flex min-h-0 min-w-0 flex-col gap-1 rounded-b-xl pt-2 text-gray-500">
        <div className="flex w-full shrink-0 flex-row items-center justify-between gap-1">
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
      </div>
    </div>
  );
}
