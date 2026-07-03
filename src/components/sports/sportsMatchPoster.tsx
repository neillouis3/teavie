'use client';

import React, { useEffect, useState } from 'react';
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
 * Sports card artwork with graceful degradation:
 * event poster → team badges → title. Broken images fall through instead of
 * leaving a blank tile.
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

  const [posterFailed, setPosterFailed] = useState(false);
  const [homeFailed, setHomeFailed] = useState(false);
  const [awayFailed, setAwayFailed] = useState(false);

  useEffect(() => setPosterFailed(false), [poster]);
  useEffect(() => setHomeFailed(false), [home]);
  useEffect(() => setAwayFailed(false), [away]);

  const showPoster = Boolean(poster) && !posterFailed;
  const showHome = Boolean(home) && !homeFailed;
  const showAway = Boolean(away) && !awayFailed;
  const showBadges = showHome || showAway;

  if (showPoster) {
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
          loading="lazy"
          onError={() => setPosterFailed(true)}
          className="h-full w-full object-contain object-center"
        />
      </div>
    );
  }

  if (showBadges) {
    return (
      <div
        className={cn(
          'flex h-full w-full items-center justify-center gap-3 bg-gradient-to-br from-default-300/50 via-default-200/80 to-default-100 px-4 py-6 dark:from-default-100/25 dark:via-default-100/15 dark:to-default-50/10 sm:gap-4',
          className
        )}
      >
        {showHome ? (
          <img
            src={home}
            alt=""
            loading="lazy"
            onError={() => setHomeFailed(true)}
            className="max-h-12 max-w-[4.25rem] shrink-0 object-contain sm:max-h-14 sm:max-w-20"
          />
        ) : null}
        {showHome && showAway ? (
          <span className="shrink-0 text-[10px] font-medium uppercase tracking-wide text-default-400 sm:text-xs">
            vs
          </span>
        ) : null}
        {showAway ? (
          <img
            src={away}
            alt=""
            loading="lazy"
            onError={() => setAwayFailed(true)}
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
