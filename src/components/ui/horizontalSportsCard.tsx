'use client';

import React from 'react';
import Link from 'next/link';
import SportsMatchPoster from '@/components/sports/sportsMatchPoster';

export type HorizontalSportsCardProps = {
  matchId: string;
  title: string;
  description: string;
  posterUrl?: string;
  homeBadgeUrl?: string;
  awayBadgeUrl?: string;
  category?: string;
  isLive?: boolean;
};

const pill =
  'rounded-sm bg-black/55 px-2.5 py-1 text-[10px] text-white backdrop-blur-sm tabular-nums';

export default function HorizontalSportsCard({
  matchId,
  title,
  description,
  homeBadgeUrl,
  awayBadgeUrl,
  posterUrl,
  category,
  isLive = true,
}: HorizontalSportsCardProps) {
  const href = `/sports/player/${matchId}`;
  const hasArtwork = Boolean(
    posterUrl?.trim() || homeBadgeUrl?.trim() || awayBadgeUrl?.trim()
  );

  return (
    <Link href={href} className="group block min-w-0 w-full" aria-label={`${title}, live stream`}>
      <div className="relative aspect-[16/10] w-full overflow-hidden rounded-lg bg-default-200 ring-1 ring-white/10">
        <SportsMatchPoster
          title={title}
          posterUrl={posterUrl}
          homeBadgeUrl={homeBadgeUrl}
          awayBadgeUrl={awayBadgeUrl}
          category={category}
          className="h-full"
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
        <div className="absolute right-2 top-2 sm:right-2.5 sm:top-2.5">
          <span className={pill}>{isLive ? 'Live' : 'Sports'}</span>
        </div>
        <div className="absolute bottom-2 left-2 right-3 max-w-[90%] sm:bottom-2.5 sm:left-2.5 sm:right-4">
          <p
            className={`line-clamp-2 text-left text-xs font-semibold leading-snug drop-shadow-md sm:text-sm ${
              hasArtwork ? 'text-white' : 'text-white/95'
            }`}
          >
            {title}
          </p>
        </div>
      </div>
      <p className="mt-2 line-clamp-2 text-sm text-default-500">{description}</p>
    </Link>
  );
}
