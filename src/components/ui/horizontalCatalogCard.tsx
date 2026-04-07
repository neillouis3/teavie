'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';

export type HorizontalCatalogCardProps = {
  id: number;
  /** Shown only in accessibility (alt / aria-label), not on screen */
  title: string;
  year: string;
  type: 'movie' | 'tv' | string;
  posterPath: string;
};

const TMDB = 'https://image.tmdb.org/t/p/w342';

const pill =
  'rounded-full bg-black/55 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white backdrop-blur-sm tabular-nums';

/**
 * Minimal catalog tile: poster, MOVIE/TV + year badges only (no title).
 * Matches the compact style used under “You might like”.
 */
export default function HorizontalCatalogCard({
  id,
  title,
  year,
  type,
  posterPath,
}: HorizontalCatalogCardProps) {
  const typeLower = String(type ?? '').toLowerCase();
  const isTv = typeLower === 'tv';
  const label = isTv ? 'TV' : 'MOVIE';
  const href = isTv ? `/shows/${id}` : `/movies/${id}`;
  const hasPoster = Boolean(posterPath?.trim());
  const src = hasPoster ? `${TMDB}${posterPath}` : null;

  return (
    <Link
      href={href}
      className="group block min-w-0 w-full"
      aria-label={`${title}, ${label}, ${year}`}
    >
      <div className="relative aspect-[2/3] w-full overflow-hidden rounded-lg bg-default-200 ring-1 ring-white/10">
        {src ? (
          <Image
            src={src}
            alt={title}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 16vw"
            className="object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center p-2 text-center text-[10px] text-default-500">
            No poster
          </div>
        )}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-black/25" />
        <div className="absolute left-2 top-2">
          <span className={pill}>{label}</span>
        </div>
        <div className="absolute right-2 top-2">
          <span className={pill}>{year}</span>
        </div>
      </div>
    </Link>
  );
}
