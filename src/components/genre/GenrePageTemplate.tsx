'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { Button, Chip } from '@heroui/react';
import Header from '@/components/ui/header';
import LargeCard from '@/components/ui/largeCard';
import CatalogRail from '@/components/explore/catalogRail';
import type { ContentItem } from '@/types/content';
import { genrePageDescription } from '@/lib/genrePageCopy';

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

function dedupeFeatured(rail: ContentItem[], featured: ContentItem[]) {
  if (featured.length === 0) return rail;
  const featuredKeys = new Set(featured.map(itemKey));
  return rail.filter((item) => !featuredKeys.has(itemKey(item)));
}

function FeaturedSkeleton() {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {Array.from({ length: 2 }).map((_, i) => (
        <div
          key={i}
          className={`${FEATURED_CARD_HEIGHT} animate-pulse rounded-2xl bg-default-200`}
        />
      ))}
    </div>
  );
}

type GenreRails = Record<GenrePageSort, ContentItem[]>;

const EMPTY_RAILS: GenreRails = {
  popular: [],
  top_rated: [],
  new: [],
};

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

  const [rails, setRails] = useState<GenreRails>(EMPTY_RAILS);
  const [featured, setFeatured] = useState<ContentItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const description = useMemo(() => genrePageDescription(genreLabel), [genreLabel]);

  useEffect(() => {
    document.title = `${genreLabel} - Teavie`;
  }, [genreLabel]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);

    const buildQs = (sort: GenrePageSort) => {
      const qs = new URLSearchParams();
      qs.set('slug', slug);
      qs.set('sort', sort);
      qs.set('limit', String(RAIL_LIMIT));
      qs.set('page', '1');
      if (type !== 'all') qs.set('type', type);
      return qs.toString();
    };

    Promise.all(
      RAIL_SECTIONS.map(({ sort }) =>
        fetch(`/api/genre?${buildQs(sort)}`, { signal: controller.signal }).then(
          (res) => res.json()
        )
      )
    )
      .then(([popularJson, topRatedJson, newJson]) => {
        const featuredItems = Array.isArray(popularJson.featured)
          ? popularJson.featured
          : [];

        setFeatured(featuredItems);
        setTotal(typeof popularJson.total === 'number' ? popularJson.total : 0);
        setRails({
          popular: dedupeFeatured(popularJson.results ?? [], featuredItems),
          top_rated: topRatedJson.results ?? [],
          new: newJson.results ?? [],
        });
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setRails(EMPTY_RAILS);
          setFeatured([]);
          setTotal(0);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
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

  const countLabel = loading ? '…' : `${total.toLocaleString()} titles`;
  const hasAnyRail =
    rails.popular.length > 0 || rails.top_rated.length > 0 || rails.new.length > 0;

  return (
    <div className="bg-main min-h-screen w-full">
      <Header pageName={genreLabel} />
      <div className="w-full space-y-4 px-3 pb-12 pt-2 sm:px-4">
        <div className="space-y-2">
          <Chip color="success" variant="flat" size="md" radius="sm">
            {countLabel}
          </Chip>
          <p className="text-left text-sm leading-relaxed text-default-500 sm:text-[15px]">
            {description}
          </p>
        </div>

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

        {(loading || featured.length > 0) && (
          <section className="mt-6 space-y-3" aria-label="Featured">
            <Chip color="success" variant="flat" size="md" radius="sm">
              Featured
            </Chip>
            {loading ? (
              <FeaturedSkeleton />
            ) : (
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
            )}
          </section>
        )}

        <div className="mt-6 flex flex-col gap-10">
          {RAIL_SECTIONS.map(({ sort, title }) => (
            <CatalogRail
              key={sort}
              title={title}
              items={rails[sort]}
              maxItems={RAIL_LIMIT}
              loading={loading}
            />
          ))}

          {!loading && !hasAnyRail && featured.length === 0 ? (
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
