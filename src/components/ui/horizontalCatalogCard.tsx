'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';

export type HorizontalCatalogCardProps = {
  id: number;
  title: string;
  year: string;
  type: 'movie' | 'tv' | string;
  posterPath?: string;
  backdropPath?: string;
};

const BASE = 'https://image.tmdb.org/t/p/';
const BACKDROP_SIZE = 'w1280';
const POSTER_SIZE = 'w500';

const pill =
  'rounded-sm bg-black/55 px-2.5 py-1 text-[10px] uppercase tracking-wide text-white backdrop-blur-sm tabular-nums';

/**
 * Wide tile: backdrop/poster, type + year pills, title on bottom-left overlay.
 */
export default function HorizontalCatalogCard({
  id,
  title,
  year,
  type,
  posterPath = '',
  backdropPath = '',
}: HorizontalCatalogCardProps) {
  const typeLower = String(type ?? '').toLowerCase();
  const isTv = typeLower === 'tv';
  const label = isTv ? 'TV' : 'MOVIE';
  const href = isTv ? `/shows/${id}` : `/movies/${id}`;

  const backdrop = backdropPath?.trim();
  const poster = posterPath?.trim();
  const src = backdrop
    ? `${BASE}${BACKDROP_SIZE}${backdrop}`
    : poster
      ? `${BASE}${POSTER_SIZE}${poster}`
      : null;

  return (
    <Link
      href={href}
      className="group block min-w-0 w-full"
      aria-label={`${title}, ${label}, ${year}`}
    >
      <div className="relative aspect-[16/10] w-full overflow-hidden rounded-lg bg-default-200 ring-1 ring-white/10">
        {src ? (
          <Image
            src={src}
            alt=""
            aria-hidden
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
            className="object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-1 p-2 text-center">
            <p className="line-clamp-2 text-xs text-foreground">
              {title}
            </p>
            <span className="text-[10px] text-default-500">No image</span>
          </div>
        )}
        {src && (
          <>
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/45 via-black/10 to-transparent" />
            <div className="absolute left-2 top-2 sm:left-2.5 sm:top-2.5">
              <span className={pill}>{label}</span>
            </div>
            <div className="absolute right-2 top-2 sm:right-2.5 sm:top-2.5">
              <span className={pill}>{year}</span>
            </div>
            <div className="absolute bottom-2 left-2 right-3 max-w-[85%] sm:bottom-2.5 sm:left-2.5 sm:right-4">
              <p className="text-left text-xs font-semibold leading-snug text-white drop-shadow-md line-clamp-2 sm:text-sm">
                {title}
              </p>
            </div>
          </>
        )}
      </div>
    </Link>
  );
}
