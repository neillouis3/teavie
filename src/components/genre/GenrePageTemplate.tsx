'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { Button } from '@heroui/react';
import Header from '@/components/ui/header';
import PageSplash from '@/components/ui/pageSplash';
import LargeCard from '@/components/ui/largeCard';
import CatalogRail from '@/components/catalog/catalogRail';
import ExploreSectionTitle from '@/components/explore/exploreSectionTitle';
import type { ContentItem } from '@/types/content';
import {
  fetchGenrePagePayload,
  type GenrePagePayload,
} from '@/lib/pageDataCache';

export type GenrePageType = 'all' | 'movie' | 'tv';
export type GenrePageSort = 'popular' | 'top_rated' | 'new';

const TYPE_OPTIONS: { key: GenrePageType; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'movie', label: 'Movies' },
  { key: 'tv', label: 'TV Shows' },
];

const RAIL_SECTIONS: { sort: GenrePageSort; title: string }[] = [
  { sort: 'popular', title: 'Popular' },
  { sort: 'top_rated', title: 'Top rated' },
  { sort: 'new', title: 'New' },
];

const RAIL_LIMIT = 24;

/** Match Explore trending hero overlay; tuned for two-up featured row. */
const FEATURED_CARD_HEIGHT =
  'h-[min(310px,40vh)] sm:h-[min(365px,44vh)]';

function itemYear(item: ContentItem) {
  const raw = item.release_date || item.first_air_date || '';
  return raw.length >= 4 ? raw.slice(0, 4) : '—';
}

function featuredReleaseIso(item: ContentItem) {
  const raw = item.release_date ?? item.first_air_date ?? '';
  return raw.length >= 10 ? raw.slice(0, 10) : null;
}

function itemKey(item: ContentItem) {
  return `${item.type ?? 'movie'}-${item.id}`;
}

type GenrePageTemplateProps = {
  slug: string;
  genreLabel: string;
};

export default function GenrePageTemplate({ slug, genreLabel }: GenrePageTemplateProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const rawType = searchParams.get('type') || 'all';
  const type: GenrePageType =
    rawType === 'movie' || rawType === 'tv' ? rawType : 'all';

  const [payload, setPayload] = useState<GenrePagePayload | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    document.title = `${genreLabel} - Teavie`;
  }, [genreLabel]);

  useEffect(() => {
    let cancelled = false;
    setReady(false);
    void fetchGenrePagePayload(slug, type).then((data) => {
      if (cancelled) return;
      setPayload(data);
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [slug, type]);

  const mergeParams = useCallback(
    (patch: Record<string, string | null | undefined>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [k, v] of Object.entries(patch)) {
        if (!v || (k === 'type' && v === 'all')) {
          params.delete(k);
        } else {
          params.set(k, String(v));
        }
      }
      params.delete('sort');
      params.delete('page');
      router.push(`${pathname}?${params.toString()}`);
    },
    [pathname, router, searchParams]
  );

  if (!ready || !payload) {
    return <PageSplash ariaLabel={`Loading ${genreLabel}`} />;
  }

  const { featured, rails } = payload;
  const hasAnyRail =
    rails.popular.length > 0 || rails.top_rated.length > 0 || rails.new.length > 0;

  return (
    <div className="bg-main min-h-screen w-full">
      <Header pageName={genreLabel} />
      <div className="w-full space-y-4 pr-3 pb-12 pt-2 sm:pr-4">
        <nav
          className="flex flex-nowrap items-center justify-start gap-2 overflow-x-auto pb-1"
          aria-label="Content type"
        >
          {TYPE_OPTIONS.map((opt) => {
            const active = type === opt.key;
            return (
              <Button
                key={`type-${opt.key}`}
                size="sm"
                radius="full"
                className="shrink-0"
                variant={active ? 'solid' : 'bordered'}
                color={active ? 'success' : 'default'}
                onPress={() => mergeParams({ type: opt.key })}
              >
                {opt.label}
              </Button>
            );
          })}
        </nav>

        {featured.length > 0 && (
          <section className="mt-6 space-y-3" aria-label="Featured">
            <ExploreSectionTitle>Featured</ExploreSectionTitle>
            <div className="grid gap-3 sm:grid-cols-2">
              {featured.map((item) => {
                const title = item.title || item.name || 'Untitled';
                const mediaType = item.type === 'tv' ? 'tv' : 'movie';
                return (
                  <div
                    key={itemKey(item)}
                    className={`${FEATURED_CARD_HEIGHT} overflow-hidden rounded-2xl`}
                  >
                    <LargeCard
                      hero
                      id={item.id}
                      title={title}
                      year={itemYear(item)}
                      releaseDate={featuredReleaseIso(item)}
                      runtimeSeconds={item.runtimeSeconds ?? undefined}
                      seasonAmount={item.season_amount ?? 0}
                      numberOfEpisodes={item.number_of_episodes ?? undefined}
                      type={mediaType}
                      posterPath={item.poster_path ?? ''}
                      backdropPath={item.backdrop_path ?? ''}
                      genres={item.genres ?? item.imdb_genres ?? []}
                      voteAverage={item.vote_average ?? null}
                      certification={item.certification ?? null}
                    />
                  </div>
                );
              })}
            </div>
          </section>
        )}

        <div className="mt-6 flex flex-col gap-10">
          {RAIL_SECTIONS.map(({ sort, title }) => (
            <CatalogRail
              key={sort}
              title={title}
              items={rails[sort]}
              maxItems={RAIL_LIMIT}
            />
          ))}

          {!hasAnyRail && featured.length === 0 ? (
            <p className="py-16 text-left text-sm text-default-500">
              No titles found for {genreLabel}. Try another filter.
            </p>
          ) : null}
        </div>

        <p className="mt-10 text-left text-xs text-default-400">
          <Link href="/genres" className="hover:text-success hover:underline">
            Browse all genres
          </Link>
        </p>
      </div>
    </div>
  );
}
