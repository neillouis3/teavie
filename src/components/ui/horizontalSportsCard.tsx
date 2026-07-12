'use client';

import React from 'react';
import Link from 'next/link';
import SportsMatchPoster from '@/components/sports/sportsMatchPoster';
import { stripEmojis } from '@/lib/stripEmojis';

export type HorizontalSportsCardProps = {
  matchId: string;
  title: string;
  metaChips?: string[];
  posterUrl?: string;
  homeBadgeUrl?: string;
  awayBadgeUrl?: string;
  category?: string;
};

function MetaChip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex shrink-0 items-center rounded-md bg-default-100/45 p-1.5 text-[11px] font-medium leading-none text-foreground/65 dark:bg-white/[0.06] dark:text-white/65">
      {children}
    </span>
  );
}

export default function HorizontalSportsCard({
  matchId,
  title,
  metaChips = [],
  homeBadgeUrl,
  awayBadgeUrl,
  posterUrl,
  category,
}: HorizontalSportsCardProps) {
  const href = `/sports/player/${matchId}`;
  const displayTitle = stripEmojis(title);

  return (
    <Link
      href={href}
      className="group flex min-w-0 w-full flex-col gap-1.5"
      aria-label={`${displayTitle}, live stream`}
    >
      <div className="relative aspect-[16/10] w-full shrink-0 overflow-hidden rounded-lg bg-default-200 ring-1 ring-white/10">
        <SportsMatchPoster
          title={title}
          posterUrl={posterUrl}
          homeBadgeUrl={homeBadgeUrl}
          awayBadgeUrl={awayBadgeUrl}
          category={category}
          className="h-full"
        />
      </div>
      <div className="flex min-w-0 flex-col gap-1">
        {metaChips.length > 0 ? (
          <div className="flex min-w-0 items-center gap-1.5 overflow-hidden whitespace-nowrap">
            {metaChips.map((chip, i) => (
              <MetaChip key={`${chip}-${i}`}>{chip}</MetaChip>
            ))}
          </div>
        ) : null}
        <p
          className="normal-case min-w-0 line-clamp-2 text-sm leading-snug text-foreground transition-colors duration-300 group-hover:text-success sm:text-[15px]"
          title={displayTitle}
        >
          {displayTitle}
        </p>
      </div>
    </Link>
  );
}
