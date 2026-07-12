'use client';

import React from 'react';
import { Image, Select, SelectItem } from '@heroui/react';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  FootballIcon,
  LiveStreaming02Icon,
} from '@hugeicons/core-free-icons';
import SportsMatchPoster from '@/components/sports/sportsMatchPoster';
import {
  formatMatchDate,
  isMatchLive,
  isMatchUpcoming,
  matchCardBadges,
  matchCardPosterUrl,
  sourceLabel,
  sportLabel,
  streamLabel,
  type StreamedMatch,
  type StreamedStream,
} from '@/lib/streamedSports';
import { stripEmojis } from '@/lib/stripEmojis';
import { cn } from '@/lib/utils';

const BORDERED_FIELD =
  'border-default-200/80 shadow-none dark:border-white/10 bg-transparent';

const SOURCE_SELECT_BASE =
  'w-full min-w-0 sm:w-32 sm:min-w-32 sm:max-w-32 sm:shrink-0';

/** Server labels run longer — 2.5× the source select width on sm+. */
const SERVER_SELECT_BASE =
  'w-full min-w-0 sm:w-104 sm:min-w-104 sm:max-w-104 sm:shrink-0';

const sourceSelectClassNames = {
  base: SOURCE_SELECT_BASE,
  value: 'font-normal text-foreground',
  selectorIcon: 'text-default-400',
  trigger: BORDERED_FIELD,
} as const;

const serverSelectClassNames = {
  base: SERVER_SELECT_BASE,
  value: 'font-normal text-foreground',
  selectorIcon: 'text-default-400',
  trigger: BORDERED_FIELD,
} as const;

function MetaDot() {
  return (
    <span className="text-default-400" aria-hidden>
      •
    </span>
  );
}

export function sportsSubtitleLine(match: StreamedMatch): string {
  const parts = ['Sports'];
  if (match.category) parts.push(sportLabel(match.category));
  const when = formatMatchDate(match.date);
  if (when && when !== '—') parts.push(when);
  return parts.join(' • ');
}

function matchOverview(match: StreamedMatch): string {
  const home = match.teams?.home?.name?.trim();
  const away = match.teams?.away?.name?.trim();
  if (home && away) return `${home} vs ${away}`;
  return stripEmojis(match.title?.trim() || '') || 'Live sports event';
}

type SportsMatchPanelProps = {
  match: StreamedMatch;
  sourceKeys: string[];
  streamsBySource: Record<string, StreamedStream[]>;
  selectedSource: string;
  selectedStreamNo: number;
  onSourceChange: (source: string) => void;
  onStreamChange: (streamNo: number) => void;
};

export default function SportsMatchPanel({
  match,
  sourceKeys,
  streamsBySource,
  selectedSource,
  selectedStreamNo,
  onSourceChange,
  onStreamChange,
}: SportsMatchPanelProps) {
  const displayTitle = stripEmojis(match.title);
  const live = isMatchLive(match);
  const upcoming = isMatchUpcoming(match);
  const posterUrl = matchCardPosterUrl(match);
  const badges = matchCardBadges(match);
  const streamsForSource = selectedSource
    ? streamsBySource[selectedSource] ?? []
    : [];

  const titleAndStats = (
    <>
      <div className="flex flex-wrap items-center gap-3">
        {badges.home ? (
          <img
            src={badges.home}
            alt=""
            className="h-10 w-10 shrink-0 object-contain sm:h-11 sm:w-11"
          />
        ) : null}
        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          {displayTitle}
        </h1>
        {badges.away ? (
          <img
            src={badges.away}
            alt=""
            className="h-10 w-10 shrink-0 object-contain sm:h-11 sm:w-11"
          />
        ) : null}
      </div>
      <p className="mt-1.5 text-sm text-default-500">{sportsSubtitleLine(match)}</p>
      <div className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
        {live ? (
          <span className="inline-flex items-center gap-1 font-medium text-success">
            <HugeiconsIcon icon={LiveStreaming02Icon} size={15} />
            Live now
          </span>
        ) : upcoming ? (
          <span className="text-foreground/80">Upcoming</span>
        ) : (
          <span className="text-foreground/80">Event</span>
        )}
        <MetaDot />
        <span className="inline-flex items-center gap-1 text-foreground/80">
          <HugeiconsIcon icon={FootballIcon} size={15} className="text-default-500" />
          {sportLabel(match.category)}
        </span>
      </div>
    </>
  );

  const overviewBlock = (
    <p className="text-sm leading-relaxed text-foreground/85 sm:text-[15px]">
      {matchOverview(match)}
    </p>
  );

  const posterEl = posterUrl ? (
    <Image
      src={posterUrl}
      alt={displayTitle}
      className="aspect-[16/10] w-full rounded-lg object-cover ring-1 ring-default-200/35 dark:ring-default-100/15"
    />
  ) : (
    <div className="aspect-[16/10] w-full overflow-hidden rounded-lg bg-default-200 ring-1 ring-default-200/35 dark:bg-default-100/20 dark:ring-default-100/15">
      <SportsMatchPoster
        title={displayTitle}
        posterUrl={posterUrl}
        homeBadgeUrl={badges.home}
        awayBadgeUrl={badges.away}
        category={match.category}
        className="h-full"
      />
    </div>
  );

  const streamControls =
    sourceKeys.length > 0 ? (
      <div className="flex w-full flex-wrap items-end gap-2">
        <Select
          aria-label="Source"
          placeholder="Source"
          size="sm"
          selectedKeys={selectedSource ? [selectedSource] : []}
          onSelectionChange={(keys) => {
            const next = Array.from(keys)[0];
            if (typeof next !== 'string' || !next) return;
            onSourceChange(next);
          }}
          radius="sm"
          variant="bordered"
          classNames={sourceSelectClassNames}
        >
          {sourceKeys.map((source) => (
            <SelectItem key={source}>{sourceLabel(source)}</SelectItem>
          ))}
        </Select>

        <Select
          aria-label="Server"
          placeholder="Server"
          size="sm"
          selectedKeys={[String(selectedStreamNo)]}
          onSelectionChange={(keys) => {
            const next = Number(Array.from(keys)[0]);
            if (Number.isFinite(next) && next > 0) onStreamChange(next);
          }}
          radius="sm"
          variant="bordered"
          isDisabled={streamsForSource.length === 0}
          classNames={serverSelectClassNames}
        >
          {streamsForSource.map((stream) => (
            <SelectItem key={String(stream.streamNo)}>
              {streamLabel(stream)}
            </SelectItem>
          ))}
        </Select>
      </div>
    ) : null;

  return (
    <div className="w-full space-y-5">
      <div className="min-w-0 sm:hidden">
        <div className="mb-4">{posterEl}</div>
        {titleAndStats}
        <div className="mt-4">{overviewBlock}</div>
      </div>

      <div className="hidden gap-5 sm:flex sm:flex-row sm:items-start lg:gap-6 xl:gap-8">
        <div className="w-48 shrink-0 md:w-56 lg:w-64 xl:w-72 2xl:w-80">{posterEl}</div>
        <div className="min-w-0 flex-1">
          {titleAndStats}
          <div className="mt-4 sm:mt-5">{overviewBlock}</div>
          {streamControls ? (
            <div className="mt-5 hidden xl:block">{streamControls}</div>
          ) : null}
        </div>
      </div>

      {streamControls ? (
        <div className={cn('space-y-4', 'xl:hidden')}>{streamControls}</div>
      ) : null}
    </div>
  );
}
