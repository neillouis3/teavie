'use client';

import React, { useState, useEffect, Suspense, useCallback } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { Input, Pagination } from '@heroui/react';
import { HugeiconsIcon } from '@hugeicons/react';
import { Search01Icon } from '@hugeicons/core-free-icons';
import Header from '@/components/ui/header';
import SmallCard from '@/components/ui/smallCard';
import HorizontalCatalogCard from '@/components/ui/horizontalCatalogCard';
import CatalogRail, { CatalogRailSkeleton } from '@/components/catalog/catalogRail';
import SearchCatalogGridLoading from '@/components/browse/skeleton/searchCatalogGridLoading';
import SearchPageSkeleton from '@/components/browse/skeleton/searchPageSkeleton';
import {
  useCatalogCardStyle,
} from '@/contexts/catalogCardStyleContext';
import SearchCatalogFilters from '@/components/browse/SearchCatalogFilters';
import { ContentItem } from '@/types/content';
import {
  fetchSearchPopular,
  fetchSearchResults,
} from '@/lib/pageDataCache';
import {
  CATALOG_GRID_HORIZONTAL_SEARCH,
  CATALOG_GRID_VERTICAL_SEARCH,
} from '@/lib/catalogGrid';

function gridClassSearch(horizontal: boolean) {
  return horizontal
    ? CATALOG_GRID_HORIZONTAL_SEARCH
    : CATALOG_GRID_VERTICAL_SEARCH;
}

function SearchContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const qParam = searchParams.get('q') ?? '';
  const rawPage = parseInt(searchParams.get('page') || '1', 10);
  const pageParam = Number.isFinite(rawPage) && rawPage >= 1 ? rawPage : 1;
  const typeParam = searchParams.get('type') ?? '';
  const genreParam = searchParams.get('genre') ?? '';
  const yearMinParam = searchParams.get('year_min') ?? '';
  const yearMaxParam = searchParams.get('year_max') ?? '';
  const sortParam = searchParams.get('sort_by') ?? '';

  const [inputValue, setInputValue] = useState(qParam);
  const [results, setResults] = useState<ContentItem[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [popularMovies, setPopularMovies] = useState<ContentItem[]>([]);
  const [popularTv, setPopularTv] = useState<ContentItem[]>([]);
  const [ready, setReady] = useState(false);
  const { mode: cardLayoutMode } = useCatalogCardStyle();
  const horizontal = cardLayoutMode === 'horizontal';
  const popularSectionMax = horizontal ? 8 : 14;

  useEffect(() => { setInputValue(qParam); }, [qParam]);

  useEffect(() => {
    document.title = qParam.trim() ? `Search: ${qParam} - Teavie` : 'Search - Teavie';
  }, [qParam]);

  const hasQuery = qParam.trim().length > 0;

  useEffect(() => {
    let cancelled = false;
    setReady(false);
    setError(null);

    if (!hasQuery) {
      void fetchSearchPopular(20).then((data) => {
        if (cancelled) return;
        setPopularMovies(data.popularMovies);
        setPopularTv(data.popularTv);
        setReady(true);
      });
      return () => {
        cancelled = true;
      };
    }

    const qs = new URLSearchParams();
    qs.set('q', qParam.trim());
    qs.set('page', String(pageParam));
    qs.set('limit', '28');
    if (typeParam && typeParam !== 'all') qs.set('type', typeParam);
    if (genreParam) qs.set('genre', genreParam);
    if (yearMinParam) qs.set('year_min', yearMinParam);
    if (yearMaxParam) qs.set('year_max', yearMaxParam);
    if (sortParam && sortParam !== 'relevance') qs.set('sort_by', sortParam);

    void fetchSearchResults(qs.toString())
      .then((data) => {
        if (cancelled) return;
        setResults(data.results);
        setTotal(data.total);
        setTotalPages(data.totalPages);
        setReady(true);
      })
      .catch((err) => {
        if (cancelled) return;
        setResults([]);
        setTotal(0);
        setTotalPages(0);
        setError(err instanceof Error ? err.message : 'Something went wrong');
        setReady(true);
      });

    return () => {
      cancelled = true;
    };
  }, [
    hasQuery,
    qParam,
    pageParam,
    typeParam,
    genreParam,
    yearMinParam,
    yearMaxParam,
    sortParam,
  ]);

  const submitSearch = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const params = new URLSearchParams(searchParams.toString());
      const trimmed = inputValue.trim();
      if (trimmed) params.set('q', trimmed);
      else params.delete('q');
      params.delete('page');
      router.push(params.toString() ? `${pathname}?${params}` : pathname);
    },
    [inputValue, pathname, router, searchParams]
  );

  const goPage = (p: number) => {
    const params = new URLSearchParams(searchParams.toString());
    if (p > 1) params.set('page', String(p));
    else params.delete('page');
    router.push(`${pathname}?${params.toString()}`);
  };

  const renderCards = (items: ContentItem[], keyPrefix: string) => (
    <div className={gridClassSearch(horizontal)}>
      {items.map((item, index) => {
        const title = item.title || item.name || 'Untitled';
        const release = item.release_date || item.first_air_date || '';
        const year = release ? String(new Date(release).getFullYear()) : '—';
        const rawId = item.id;
        const id =
          typeof rawId === 'number' && Number.isFinite(rawId)
            ? rawId
            : /^\d+$/.test(String(rawId))
              ? Number(rawId)
              : rawId;
        const type = item.type || 'movie';
        const poster = item.poster_path || '';

        if (horizontal) {
          return (
            <HorizontalCatalogCard
              key={`${keyPrefix}-${type}-${item.id}-${index}`}
              id={id}
              title={title}
              year={year}
              type={type}
              posterPath={poster}
              backdropPath={item.backdrop_path || ''}
            />
          );
        }

        return (
          <SmallCard
            key={`${keyPrefix}-${type}-${item.id}-${index}`}
            id={id}
            title={title}
            year={year}
            type={type}
            runtimeSeconds={item.runtimeSeconds ?? undefined}
            seasonAmount={item.season_amount ?? 0}
            numberOfEpisodes={item.number_of_episodes ?? undefined}
            posterPath={poster}
          />
        );
      })}
    </div>
  );

  if (!ready) {
    return (
      <div className="bg-main min-h-screen w-full">
        <Header pageName="Search" />

        <div className="space-y-6 px-3 pb-6 pt-6 sm:px-4 sm:pt-8">
          <form onSubmit={submitSearch} className="w-full">
            <Input
              aria-label="Search query"
              placeholder="Search titles…"
              value={inputValue}
              onValueChange={setInputValue}
              size="sm"
              variant="flat"
              radius="sm"
              className="w-full"
              startContent={
                <HugeiconsIcon
                  icon={Search01Icon}
                  size={16}
                  className="shrink-0 text-default-400"
                />
              }
              classNames={{
                base: 'w-full',
                input: 'text-sm',
                inputWrapper: 'h-9 w-full bg-default-100 hover:bg-default-200',
              }}
            />
          </form>

          <SearchCatalogFilters
            total={0}
            loading
            hasQuery={hasQuery}
          />

          {hasQuery ? (
            <SearchCatalogGridLoading />
          ) : (
            <div className="space-y-8">
              <section className="space-y-3">
                <div className="h-6 w-36 animate-pulse rounded-md bg-default-200" />
                <CatalogRailSkeleton
                  horizontal={horizontal}
                  count={popularSectionMax}
                />
              </section>
              <section className="space-y-3">
                <div className="h-6 w-28 animate-pulse rounded-md bg-default-200" />
                <CatalogRailSkeleton
                  horizontal={horizontal}
                  count={popularSectionMax}
                />
              </section>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-main min-h-screen w-full">
      <Header pageName="Search" />

      <div className="space-y-6 px-3 pb-6 pt-6 sm:px-4 sm:pt-8">
        <form onSubmit={submitSearch} className="w-full">
          <Input
            aria-label="Search query"
            placeholder="Search titles…"
            value={inputValue}
            onValueChange={setInputValue}
            size="sm"
            variant="flat"
            radius="sm"
            className="w-full"
            startContent={
              <HugeiconsIcon
                icon={Search01Icon}
                size={16}
                className="shrink-0 text-default-400"
              />
            }
            classNames={{
              base: 'w-full',
              input: 'text-sm',
              inputWrapper: 'h-9 w-full bg-default-100 hover:bg-default-200',
            }}
          />
        </form>

        <SearchCatalogFilters
          total={total}
          loading={false}
          hasQuery={hasQuery}
        />

        {!hasQuery && (
          <div className="space-y-8">
            <section className="space-y-3">
              <CatalogRail
                title="Popular Movies"
                items={popularMovies}
                maxItems={popularSectionMax}
              />
            </section>
            <section className="space-y-3">
              <CatalogRail
                title="Popular TV"
                items={popularTv}
                maxItems={popularSectionMax}
              />
            </section>
          </div>
        )}

        {hasQuery && (
          <div className="space-y-4">
            <span className="text-xs text-default-500">
              for &ldquo;{qParam}&rdquo;{totalPages > 1 && ` · page ${pageParam} of ${totalPages}`}
            </span>

            {error && (
              <p className="text-sm text-danger">{error}</p>
            )}

            {!error && results.length > 0 && (
              <>
                {renderCards(results, 'q')}
                {totalPages > 1 && (
                  <div className="flex justify-center pt-2">
                    <Pagination
                      total={totalPages}
                      page={pageParam}
                      onChange={goPage}
                      showControls
                      size="sm"
                      color="success"
                      variant="flat"
                    />
                  </div>
                )}
              </>
            )}

            {!error && results.length === 0 && (
              <p className="py-12 text-center text-sm text-default-500">
                No matches for &ldquo;{qParam}&rdquo;. Try another title.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<SearchPageSkeleton />}>
      <SearchContent />
    </Suspense>
  );
}
