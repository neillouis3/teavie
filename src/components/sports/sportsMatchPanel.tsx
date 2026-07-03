'use client';

import React from 'react';
import { Image, Select, SelectItem } from '@heroui/react';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  Calendar03Icon,
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

const DETAIL_META_CARD =
  'w-full overflow-hidden rounded-xl border border-solid border-default-200/55 dark:border-default-100/35';

const DETAIL_META_CARD_INNER =
  'bg-default-50 px-4 py-5 dark:bg-default-50/10 sm:px-6 sm:py-6';

function MetaDot() {
  return (
    <span className="text-default-400" aria-hidden>
      •
    </span>
  );
}

function ColumnHeading({ label }: { label: string }) {
  return <h3 className="text-xs font-medium text-default-500">{label}</h3>;
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
  return match.title?.trim() || 'Live sports event';
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
  const live = isMatchLive(match);
  const upcoming = isMatchUpcoming(match);
  const posterUrl = matchCardPosterUrl(match);
  const badges = matchCardBadges(match);
  const streamsForSource = selectedSource
    ? streamsBySource[selectedSource] ?? []
    : [];

  const titleAndStats = (
    <>
      <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
        {match.title}
      </h1>
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
      alt={match.title}
      className="aspect-[2/3] w-full rounded-lg object-cover ring-1 ring-default-200/35 dark:ring-default-100/15"
    />
  ) : (
    <div className="aspect-[2/3] w-full overflow-hidden rounded-lg ring-1 ring-default-200/35 dark:ring-default-100/15">
      <SportsMatchPoster
        title={match.title}
        homeBadgeUrl={badges.home}
        awayBadgeUrl={badges.away}
        category={match.category}
        className="h-full"
      />
    </div>
  );

  const streamControls =
    sourceKeys.length > 0 ? (
      <div className="grid gap-3 sm:grid-cols-2">
        <Select
          label="Source"
          selectedKeys={selectedSource ? [selectedSource] : []}
          onSelectionChange={(keys) => {
            const next = Array.from(keys)[0];
            if (typeof next !== 'string' || !next) return;
            onSourceChange(next);
          }}
          radius="sm"
          variant="bordered"
          classNames={{
            trigger: 'border-default-300 bg-background dark:border-white/10',
          }}
        >
          {sourceKeys.map((source) => (
            <SelectItem key={source}>{sourceLabel(source)}</SelectItem>
          ))}
        </Select>

        <Select
          label="Server"
          selectedKeys={[String(selectedStreamNo)]}
          onSelectionChange={(keys) => {
            const next = Number(Array.from(keys)[0]);
            if (Number.isFinite(next) && next > 0) onStreamChange(next);
          }}
          radius="sm"
          variant="bordered"
          isDisabled={streamsForSource.length === 0}
          classNames={{
            trigger: 'border-default-300 bg-background dark:border-white/10',
          }}
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
      <div className="min-w-0 sm:hidden">{titleAndStats}</div>

      <div className="flex gap-4 sm:hidden">
        <div className="w-28 shrink-0">{posterEl}</div>
        <div className="min-w-0 flex-1 pt-0.5">{overviewBlock}</div>
      </div>

      <div className="hidden gap-5 sm:flex sm:flex-row">
        <div className="w-32 shrink-0 md:w-36 lg:w-40">{posterEl}</div>
        <div className="min-w-0 flex-1">
          {titleAndStats}
          <div className="mt-4 sm:mt-5">{overviewBlock}</div>
        </div>
      </div>

      {streamControls ? <div className="space-y-4">{streamControls}</div> : null}

      <section className={DETAIL_META_CARD}>
        <div className={DETAIL_META_CARD_INNER}>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-4">
            <div className="min-w-0 flex-1">
              <ColumnHeading label="Sport" />
              <p className="mt-2.5 text-sm text-foreground">{sportLabel(match.category)}</p>
            </div>
            <div className="min-w-0 flex-[2]">
              <ColumnHeading label="Info" />
              <ul className="mt-2.5 grid w-full max-w-full grid-cols-1 gap-x-4 gap-y-2 text-sm text-foreground sm:max-w-[85%] sm:grid-cols-2">
                <li className="flex items-start gap-2 leading-snug">
                  <HugeiconsIcon
                    icon={Calendar03Icon}
                    size={15}
                    className="mt-0.5 shrink-0 text-default-500"
                  />
                  <span>{formatMatchDate(match.date)}</span>
                </li>
                <li className="flex items-start gap-2 leading-snug">
                  <HugeiconsIcon
                    icon={LiveStreaming02Icon}
                    size={15}
                    className="mt-0.5 shrink-0 text-default-500"
                  />
                  <span>
                    {live ? 'Live now' : upcoming ? 'Upcoming' : 'Scheduled'}
                  </span>
                </li>
                {match.teams?.home?.name ? (
                  <li className="flex items-start gap-2 leading-snug sm:col-span-2">
                    <HugeiconsIcon
                      icon={FootballIcon}
                      size={15}
                      className="mt-0.5 shrink-0 text-default-500"
                    />
                    <span>
                      {match.teams.home.name}
                      {match.teams.away?.name ? ` vs ${match.teams.away.name}` : ''}
                    </span>
                  </li>
                ) : null}
              </ul>
            </div>
            <div className="min-w-0 flex-1">
              <ColumnHeading label="Streams" />
              <p className="mt-2.5 text-sm text-foreground">
                {sourceKeys.length > 0
                  ? `${sourceKeys.length} source${sourceKeys.length === 1 ? '' : 's'} available`
                  : 'No active streams'}
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
