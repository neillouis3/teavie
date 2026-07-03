'use client';

import React from 'react';
import { sportLabel } from '@/lib/streamedSports';
import { cn } from '@/lib/utils';

type SportsMatchPosterProps = {
  title: string;
  posterUrl?: string;
  homeBadgeUrl?: string;
  awayBadgeUrl?: string;
  category?: string;
  className?: string;
};

/**
 * Sports card artwork: event poster (fit, not crop), team badges, or title fallback.
 */
export default function SportsMatchPoster({
  title,
  posterUrl = '',
  homeBadgeUrl = '',
  awayBadgeUrl = '',
  category,
  className = '',
}: SportsMatchPosterProps) {
  const poster = posterUrl.trim();
  const home = homeBadgeUrl.trim();
  const away = awayBadgeUrl.trim();

  if (poster) {
    return (
      <div
        className={cn(
          'flex h-full w-full items-center justify-center bg-default-300/40 dark:bg-default-100/20',
          className
        )}
      >
        <img
          src={poster}
          alt=""
          className="h-full w-full object-contain object-center"
        />
      </div>
    );
  }

  if (home || away) {
    return (
      <div
        className={cn(
          'flex h-full w-full items-center justify-center gap-3 bg-gradient-to-br from-default-300/50 via-default-200/80 to-default-100 px-4 py-6 dark:from-default-100/25 dark:via-default-100/15 dark:to-default-50/10 sm:gap-4',
          className
        )}
      >
        {home ? (
          <img
            src={home}
            alt=""
            className="max-h-12 max-w-[4.25rem] shrink-0 object-contain sm:max-h-14 sm:max-w-20"
          />
        ) : null}
        {home && away ? (
          <span className="shrink-0 text-[10px] font-medium uppercase tracking-wide text-default-400 sm:text-xs">
            vs
          </span>
        ) : null}
        {away ? (
          <img
            src={away}
            alt=""
            className="max-h-12 max-w-[4.25rem] shrink-0 object-contain sm:max-h-14 sm:max-w-20"
          />
        ) : null}
      </div>
    );
  }

  return (
    <div
      className={cn(
        'flex h-full w-full flex-col items-center justify-center gap-2 bg-gradient-to-br from-default-300/40 to-default-100 p-4 text-center dark:from-default-100/20 dark:to-default-50/10',
        className
      )}
    >
      <p className="line-clamp-4 text-sm font-semibold leading-snug text-foreground sm:text-base">
        {title}
      </p>
      {category ? (
        <p className="text-xs text-default-500">{sportLabel(category)}</p>
      ) : null}
    </div>
  );
}
