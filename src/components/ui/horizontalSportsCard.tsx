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
        <div className="absolute right-2 top-2 sm:right-2.5 sm:top-2.5">
          <span className={pill}>{isLive ? 'Live' : 'Sports'}</span>
        </div>
      </div>
      <div className="mt-2 min-w-0">
        <p className="line-clamp-2 text-sm font-semibold leading-snug text-foreground transition-colors group-hover:text-success">
          {title}
        </p>
        <p className="mt-0.5 line-clamp-2 text-sm text-default-500">{description}</p>
      </div>
    </Link>
  );
}
