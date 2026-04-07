'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import type { CatalogCardStyleMode } from '@/contexts/catalogCardStyleContext';

export type CatalogCardProps = {
  id: number;
  title: string;
  year: string;
  voteAverage?: number | null;
  runtimeSeconds?: number | null;
  seasonAmount?: number | null;
  type: 'movie' | 'tv' | string;
  posterPath?: string | null;
  backdropPath?: string | null;
  styleMode: CatalogCardStyleMode;
};

const TMDB = 'https://image.tmdb.org/t/p/';
const BACKDROP = 'w780';
const POSTER = 'w500';

function StarIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden
    >
      <path
        fillRule="evenodd"
        d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.006 5.404.434c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.434 2.082-5.005Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

export default function CatalogCard({
  id,
  title,
  year,
  voteAverage,
  runtimeSeconds,
  seasonAmount,
  type,
  posterPath,
  backdropPath,
  styleMode,
}: CatalogCardProps) {
  const typeLower = String(type ?? '').toLowerCase();
  const isTv = typeLower === 'tv';
  const label = isTv ? 'TV' : 'MOVIE';
  const href = isTv ? `/shows/${id}` : `/movies/${id}`;

  const backdrop = backdropPath?.trim();
  const poster = posterPath?.trim();
  const imageUrl = backdrop
    ? `${TMDB}${BACKDROP}${backdrop}`
    : poster
      ? `${TMDB}${POSTER}${poster}`
      : '';

  const runtimeMin =
    runtimeSeconds != null && runtimeSeconds > 0
      ? Math.round(runtimeSeconds / 60)
      : null;
  const runtimeLabel = isTv
    ? seasonAmount != null && seasonAmount > 0
      ? `${seasonAmount} season${seasonAmount === 1 ? '' : 's'}`
      : runtimeMin != null
        ? `${runtimeMin} min`
        : '—'
    : runtimeMin != null
      ? `${runtimeMin} min`
      : '—';

  const ratingText =
    voteAverage != null && !Number.isNaN(voteAverage)
      ? voteAverage.toFixed(1)
      : '—';

  const pill =
    'rounded-full bg-black/55 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white backdrop-blur-sm';

  return (
    <Link href={href} className="group block min-w-0 w-full">
      <div className="relative aspect-[16/10] w-full overflow-hidden rounded-xl bg-default-200 ring-1 ring-white/10">
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={title}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 16vw"
            className="object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center px-3 text-center text-xs text-default-500">
            No image
          </div>
        )}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-black/20" />

        <div className="absolute left-2 top-2 sm:left-3 sm:top-3">
          <span className={pill}>{label}</span>
        </div>

        <div className="absolute right-2 top-2 sm:right-3 sm:top-3">
          {styleMode === 'rating' ? (
            <span
              className={`${pill} inline-flex items-center gap-1 text-warning`}
            >
              <StarIcon className="size-3 shrink-0 text-danger" />
              <span className="text-white tabular-nums">{ratingText}</span>
            </span>
          ) : (
            <span className={`${pill} tabular-nums`}>{year}</span>
          )}
        </div>

        <div className="absolute bottom-0 left-0 right-0 flex items-end justify-between gap-2 px-3 pb-3 pt-8 sm:px-4 sm:pb-3.5">
          <h2 className="min-w-0 flex-1 text-sm font-semibold leading-snug text-white drop-shadow-md line-clamp-2 sm:text-base">
            {title}
          </h2>
          {styleMode === 'yearRuntime' && (
            <span
              className={`${pill} shrink-0 tabular-nums normal-case`}
              title={isTv ? 'Seasons' : 'Runtime'}
            >
              {runtimeLabel}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
