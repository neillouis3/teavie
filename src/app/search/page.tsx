'use client';

import React, { useState, useEffect, Suspense, useCallback } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { Input, Chip, Pagination } from '@heroui/react';
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import Header from '@/components/ui/header';
import SmallCard from '@/components/ui/smallCard';
import HorizontalCatalogCard from '@/components/ui/horizontalCatalogCard';
import SmallCardLoading from '@/components/ui/smallCardLoading';
import HorizontalCatalogCardLoading from '@/components/ui/horizontalCatalogCardLoading';
import CatalogCardStyleToggle from '@/components/ui/CatalogCardStyleToggle';
import {
  useCatalogCardStyle,
  type CatalogCardLayoutMode,
} from '@/contexts/catalogCardStyleContext';
import AllMoviesViewerLoading from '@/components/viewer/skeleton/allMoviesViewerLoading';
import { ContentItem } from '@/types/content';
import {
  CATALOG_GRID_HORIZONTAL_SEARCH,
  CATALOG_GRID_VERTICAL_SEARCH,
} from '@/lib/catalogGrid';

function gridClassSearch(layoutMode: CatalogCardLayoutMode) {
  return layoutMode === 'horizontal'
    ? CATALOG_GRID_HORIZONTAL_SEARCH
    : CATALOG_GRID_VERTICAL_SEARCH;
}

function CardGridSkeleton({
  count,
  layoutMode,
}: {
  count: number;
  layoutMode: CatalogCardLayoutMode;
}) {
  const horizontal = layoutMode === 'horizontal';
  const S = horizontal ? HorizontalCatalogCardLoading : SmallCardLoading;
  return (
    <div className={gridClassSearch(layoutMode)}>
      {Array.from({ length: count }).map((_, i) => (
        <S key={i} />
      ))}
    </div>
  );
}

function SearchContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const qParam = searchParams.get('q') ?? '';
  const rawPage = parseInt(searchParams.get('page') || '1', 10);
  const pageParam = Number.isFinite(rawPage) && rawPage >= 1 ? rawPage : 1;

  const [inputValue, setInputValue] = useState(qParam);
  const [results, setResults] = useState<ContentItem[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [popularMovies, setPopularMovies] = useState<ContentItem[]>([]);
  const [popularTv, setPopularTv] = useState<ContentItem[]>([]);
  const [popularLoading, setPopularLoading] = useState(false);
  const { mode: cardLayoutMode } = useCatalogCardStyle();
  const horizontal = cardLayoutMode === 'horizontal';

  useEffect(() => { setInputValue(qParam); }, [qParam]);

  useEffect(() => {
    document.title = qParam.trim() ? `Search: ${qParam} - Teavie` : 'Search - Teavie';
  }, [qParam]);

  const hasQuery = qParam.trim().length > 0;

  useEffect(() => {
    if (hasQuery) return;
    const controller = new AbortController();
    setPopularLoading(true);

    fetch('/api/tmdb/popular', { signal: controller.signal })
      .then((res) => res.json())
      .then((data) => {
        setPopularMovies(data.movies ?? []);
        setPopularTv(data.tv ?? []);
      })
      .catch(() => {})
      .finally(() => setPopularLoading(false));

    return () => controller.abort();
  }, [hasQuery]);

  useEffect(() => {
    const q = qParam.trim();
    if (!q) { setResults([]); setTotal(0); setTotalPages(0); setError(null); return; }

    const controller = new AbortController();
    setLoading(true);
    setError(null);

    fetch(`/api/search?q=${encodeURIComponent(q)}&page=${pageParam}`, { signal: controller.signal })
      .then((res) => res.json())
      .then((data) => {
        setResults(data.results ?? []);
        setTotal(data.total ?? 0);
        setTotalPages(data.totalPages ?? 0);
      })
      .catch((err) => {
        if (err.name !== 'AbortError') {
          setResults([]); setTotal(0); setTotalPages(0);
          setError(err instanceof Error ? err.message : 'Something went wrong');
        }
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [qParam, pageParam]);

  const submitSearch = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const trimmed = inputValue.trim();
      const params = new URLSearchParams();
      if (trimmed) params.set('q', trimmed);
      router.push(trimmed ? `${pathname}?${params}` : pathname);
    },
    [inputValue, pathname, router]
  );

  const goPage = (p: number) => {
    const params = new URLSearchParams();
    if (qParam.trim()) params.set('q', qParam.trim());
    if (p > 1) params.set('page', String(p));
    router.push(params.toString() ? `${pathname}?${params}` : pathname);
  };

  const renderCards = (items: ContentItem[], keyPrefix: string) => (
    <div className={gridClassSearch(cardLayoutMode)}>
      {items.map((item, index) => {
        const title = item.title || item.name || 'Untitled';
        const release = item.release_date || item.first_air_date || '';
        const year = release ? String(new Date(release).getFullYear()) : '—';
        const nid =
          typeof item.id === 'number' ? item.id : parseInt(String(item.id), 10);
        const id = Number.isFinite(nid) ? nid : 0;
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
            posterPath={poster}
          />
        );
      })}
    </div>
  );

  return (
    <div className="bg-main min-h-screen w-full">
      <Header pageName="Search" />

      <div className="space-y-6 px-4 pb-6 pt-8">
        <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <form onSubmit={submitSearch} className="w-full min-w-0 sm:flex-1">
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
              <MagnifyingGlassIcon className="h-4 w-4 shrink-0 text-default-400" />
            }
            classNames={{
              base: 'w-full',
              input: 'text-sm',
              inputWrapper: 'h-9 w-full bg-default-100 hover:bg-default-200',
            }}
          />
          </form>
          <CatalogCardStyleToggle className="shrink-0" />
        </div>

        {/* Popular (no query) */}
        {!hasQuery && (
          <div className="space-y-8">
            {popularLoading ? (
              <>
                <CardGridSkeleton count={6} layoutMode={cardLayoutMode} />
                <CardGridSkeleton count={6} layoutMode={cardLayoutMode} />
              </>
            ) : (
              <>
                <section className="space-y-3">
                  <Chip color="success" size="md" radius="sm" variant="flat">Popular Movies</Chip>
                  {popularMovies.length === 0
                    ? <p className="text-sm text-default-500">Nothing to show.</p>
                    : renderCards(popularMovies, 'pop-m')}
                </section>

                <section className="space-y-3">
                  <Chip color="success" size="md" radius="sm" variant="flat">Popular TV</Chip>
                  {popularTv.length === 0
                    ? <p className="text-sm text-default-500">Nothing to show.</p>
                    : renderCards(popularTv, 'pop-tv')}
                </section>
              </>
            )}
          </div>
        )}

        {/* Search results */}
        {hasQuery && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Chip color="success" size="md" radius="sm" variant="flat">
                {loading ? 'Searching…' : `${total} result${total === 1 ? '' : 's'}`}
              </Chip>
              {!loading && (
                <span className="text-xs text-default-500">
                  for &ldquo;{qParam}&rdquo;{totalPages > 1 && ` · page ${pageParam} of ${totalPages}`}
                </span>
              )}
            </div>

            {error && (
              <p className="text-sm text-danger">{error}</p>
            )}

            {loading && (
              <CardGridSkeleton count={12} layoutMode={cardLayoutMode} />
            )}

            {!loading && !error && results.length > 0 && (
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

            {!loading && !error && results.length === 0 && (
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
    <Suspense
      fallback={
        <div className="bg-main min-h-screen w-full">
          <Header pageName="Search" />
          <div className="px-4 pb-6 pt-8">
            <AllMoviesViewerLoading />
          </div>
        </div>
      }
    >
      <SearchContent />
    </Suspense>
  );
}
