'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Input, Spinner } from '@heroui/react';
import Header from '@/components/ui/header';
import HorizontalSportsCard from '@/components/ui/horizontalSportsCard';
import { CATALOG_GRID_HORIZONTAL } from '@/lib/catalogGrid';
import { CONTENT_INSET_X } from '@/lib/contentInset';
import {
  filterMatches,
  loadSportsMatches,
  matchCardBadges,
  matchCardPosterUrl,
  matchMetaChips,
  fetchStreamedSports,
  type SportsViewFilter,
  type StreamedMatch,
  type StreamedSport,
} from '@/lib/streamedSports';
import { cn } from '@/lib/utils';

const VIEW_TABS: { id: SportsViewFilter; label: string }[] = [
  { id: 'popular', label: 'Popular' },
  { id: 'live', label: 'Live' },
  { id: 'all', label: 'All' },
  { id: 'today', label: 'Today' },
];

function emptyMessage(view: SportsViewFilter): string {
  if (view === 'live') {
    return 'No live matches right now. Try Popular or Today.';
  }
  if (view === 'today') {
    return 'No matches scheduled for today.';
  }
  if (view === 'popular') {
    return 'No popular matches available at the moment.';
  }
  return 'No matches available.';
}

export default function SportsHub() {
  const [sports, setSports] = useState<StreamedSport[]>([]);
  const [sportId, setSportId] = useState('all');
  const [view, setView] = useState<SportsViewFilter>('popular');
  const [query, setQuery] = useState('');
  const [matches, setMatches] = useState<StreamedMatch[]>([]);
  const [loadingSports, setLoadingSports] = useState(true);
  const [loadingMatches, setLoadingMatches] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoadingSports(true);
      try {
        const rows = await fetchStreamedSports();
        if (!cancelled) setSports(rows);
      } finally {
        if (!cancelled) setLoadingSports(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoadingMatches(true);
      setError(null);
      try {
        const rows = await loadSportsMatches(sportId, view);
        if (!cancelled) setMatches(rows);
      } catch {
        if (!cancelled) {
          setMatches([]);
          setError('Could not load sports events. Please try again.');
        }
      } finally {
        if (!cancelled) setLoadingMatches(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sportId, view]);

  const visibleMatches = useMemo(
    () => filterMatches(query, matches),
    [query, matches]
  );

  return (
    <div className="min-h-screen w-full bg-main">
      <Header pageName="Sports" />
      <div className={`space-y-4 pb-8 pt-2 xl:space-y-5 ${CONTENT_INSET_X}`}>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between lg:gap-4">
          <Input
            type="search"
            placeholder="Search teams or events…"
            value={query}
            onValueChange={setQuery}
            radius="sm"
            variant="bordered"
            className="w-full lg:max-w-sm xl:max-w-md"
            classNames={{
              inputWrapper:
                'border-default-300 bg-default-50 dark:border-white/10 dark:bg-default-100/10',
            }}
          />

          <div className="flex shrink-0 flex-wrap gap-2 lg:justify-end">
            {VIEW_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setView(tab.id)}
                className={cn(
                  'rounded-lg px-2 py-1 text-xs transition-colors',
                  view === tab.id
                    ? 'bg-foreground text-background'
                    : 'border border-default-300 text-foreground hover:bg-default-100 dark:border-white/10'
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-0.5 lg:flex-wrap lg:overflow-visible">
          <button
            type="button"
            onClick={() => setSportId('all')}
            className={cn(
              'shrink-0 rounded-lg px-2 py-1 text-xs transition-colors',
              sportId === 'all'
                ? 'bg-success text-success-foreground'
                : 'border border-default-300 text-foreground hover:bg-default-100 dark:border-white/10'
            )}
          >
            All Sports
          </button>
          {loadingSports
            ? Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="h-7 w-24 shrink-0 animate-pulse rounded-lg bg-default-200"
                />
              ))
            : sports.map((sport) => (
                <button
                  key={sport.id}
                  type="button"
                  onClick={() => setSportId(sport.id)}
                  className={cn(
                    'shrink-0 rounded-lg px-2 py-1 text-xs transition-colors',
                    sportId === sport.id
                      ? 'bg-success text-success-foreground'
                      : 'border border-default-300 text-foreground hover:bg-default-100 dark:border-white/10'
                  )}
                >
                  {sport.name}
                </button>
              ))}
        </div>

        {error ? (
          <p className="text-sm text-danger">{error}</p>
        ) : null}

        {loadingMatches ? (
          <div className="flex items-center justify-center py-16">
            <Spinner color="success" />
          </div>
        ) : visibleMatches.length === 0 ? (
          <p className="py-12 text-center text-sm text-default-500">
            {emptyMessage(view)}
          </p>
        ) : (
          <div className={`${CATALOG_GRID_HORIZONTAL} items-start`}>
            {visibleMatches.map((match) => {
              const badges = matchCardBadges(match);
              return (
                <HorizontalSportsCard
                  key={match.id}
                  matchId={match.id}
                  title={match.title}
                  metaChips={matchMetaChips(match)}
                  posterUrl={matchCardPosterUrl(match)}
                  homeBadgeUrl={badges.home}
                  awayBadgeUrl={badges.away}
                  category={match.category}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
