'use client';

import React, { useState, useEffect, Suspense, useCallback } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import {
  Input,
  Button,
  Chip,
  Card,
  CardBody,
  Alert,
  Pagination,
  Divider,
} from '@heroui/react';
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import Header from '@/components/ui/header';
import SmallCard from '@/components/ui/smallCard';
import SmallCardLoading from '@/components/ui/smallCardLoading';
import AllMoviesViewerLoading from '@/components/viewer/skeleton/allMoviesViewerLoading';
import { ContentItem } from '@/types/content';

const GRID =
  'grid w-full grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6';

function CardGridSkeleton({ count }: { count: number }) {
  return (
    <div className={GRID}>
      {Array.from({ length: count }).map((_, i) => (
        <SmallCardLoading key={i} />
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
  const [popularError, setPopularError] = useState<string | null>(null);

  useEffect(() => {
    setInputValue(qParam);
  }, [qParam]);

  useEffect(() => {
    if (qParam.trim()) {
      document.title = `Search: ${qParam} - Teavie`;
    } else {
      document.title = 'Search - Teavie';
    }
  }, [qParam]);

  const hasQuery = qParam.trim().length > 0;

  useEffect(() => {
    if (hasQuery) return;

    const controller = new AbortController();
    setPopularLoading(true);
    setPopularError(null);

    fetch('/api/tmdb/popular', { signal: controller.signal })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data.error || 'Could not load popular titles');
        }
        return data;
      })
      .then((data) => {
        setPopularMovies(data.movies ?? []);
        setPopularTv(data.tv ?? []);
      })
      .catch((err) => {
        if (err.name !== 'AbortError') {
          setPopularMovies([]);
          setPopularTv([]);
          setPopularError(
            err instanceof Error ? err.message : 'Something went wrong'
          );
        }
      })
      .finally(() => setPopularLoading(false));

    return () => controller.abort();
  }, [hasQuery]);

  useEffect(() => {
    const q = qParam.trim();
    if (!q) {
      setResults([]);
      setTotal(0);
      setTotalPages(0);
      setError(null);
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    setError(null);

    fetch(`/api/search?q=${encodeURIComponent(q)}&page=${pageParam}`, {
      signal: controller.signal,
    })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data.error || 'Search failed');
        }
        return data;
      })
      .then((data) => {
        setResults(data.results ?? []);
        setTotal(data.total ?? 0);
        setTotalPages(data.totalPages ?? 0);
      })
      .catch((err) => {
        if (err.name !== 'AbortError') {
          setResults([]);
          setTotal(0);
          setTotalPages(0);
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
      if (trimmed) {
        params.set('q', trimmed);
      }
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

  const renderSmallCards = (items: ContentItem[], keyPrefix: string) => (
    <div className={GRID}>
      {items.map((item, index) => {
        const title = item.title || item.name || 'Untitled';
        const year =
          item.release_date?.split('-')[0] ||
          item.first_air_date?.split('-')[0] ||
          '—';
        return (
          <SmallCard
            key={`${keyPrefix}-${item.type ?? 'x'}-${item.id}-${index}`}
            id={
              typeof item.id === 'string' ? parseInt(item.id, 10) : item.id
            }
            title={title}
            year={year}
            type={item.type || 'movie'}
            runtimeSeconds={item.runtimeSeconds ?? undefined}
            seasonAmount={item.season_amount ?? 0}
            posterPath={item.poster_path || ''}
          />
        );
      })}
    </div>
  );

  return (
    <div className="bg-main flex h-full w-full flex-col">
      <Header pageName="Search" />

      <div className="my-4 flex w-full flex-col px-4">
        <Card shadow="sm" className="mb-6 w-full border border-default-200/60">
          <CardBody className="gap-4">
            <p className="text-small text-default-500">
              Find movies and TV by title. Results use TMDB and open on Teavie
              detail pages.
            </p>
            <form
              onSubmit={submitSearch}
              className="flex w-full flex-col gap-3 sm:flex-row sm:items-center"
            >
              <Input
                aria-label="Search query"
                placeholder="Search movies and shows…"
                value={inputValue}
                onValueChange={setInputValue}
                size="lg"
                variant="bordered"
                radius="lg"
                classNames={{
                  input: 'text-base',
                  inputWrapper: 'bg-default-100/50 flex-1',
                  base: 'flex-1 w-full',
                }}
                startContent={
                  <MagnifyingGlassIcon className="h-5 w-5 shrink-0 text-default-400" />
                }
              />
              <Button
                type="submit"
                color="success"
                size="lg"
                radius="lg"
                className="w-full shrink-0 font-semibold sm:w-auto sm:min-w-[120px]"
              >
                Search
              </Button>
            </form>
          </CardBody>
        </Card>

        {!hasQuery && (
          <div className="flex w-full flex-col gap-8">
            {popularError && (
              <Alert
                color="danger"
                variant="flat"
                title="Couldn’t load popular titles"
                description={popularError}
              />
            )}

            {popularLoading && (
              <div className="flex flex-col gap-8">
                <div>
                  <Chip
                    color="success"
                    size="lg"
                    radius="sm"
                    variant="flat"
                    className="mb-4"
                  >
                    Popular movies
                  </Chip>
                  <CardGridSkeleton count={6} />
                </div>
                <div>
                  <Chip
                    color="success"
                    size="lg"
                    radius="sm"
                    variant="flat"
                    className="mb-4"
                  >
                    Popular TV
                  </Chip>
                  <CardGridSkeleton count={6} />
                </div>
              </div>
            )}

            {!popularLoading && !popularError && (
              <>
                <div className="flex flex-col">
                  <div className="mb-4 pl-0">
                    <Chip color="success" size="lg" radius="sm" variant="flat">
                      Popular movies
                    </Chip>
                  </div>
                  {popularMovies.length === 0 ? (
                    <p className="text-small text-default-500">
                      No titles to show.
                    </p>
                  ) : (
                    renderSmallCards(popularMovies, 'pop-m')
                  )}
                </div>

                <Divider className="my-2" />

                <div className="flex flex-col">
                  <div className="mb-4 pl-0">
                    <Chip color="success" size="lg" radius="sm" variant="flat">
                      Popular TV
                    </Chip>
                  </div>
                  {popularTv.length === 0 ? (
                    <p className="text-small text-default-500">
                      No titles to show.
                    </p>
                  ) : (
                    renderSmallCards(popularTv, 'pop-tv')
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {hasQuery && (
          <div className="flex w-full flex-col">
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <Chip color="success" size="lg" radius="sm" variant="flat">
                {loading ? 'Searching…' : `${total} result${total === 1 ? '' : 's'}`}
              </Chip>
              {!loading && (
                <span className="text-small text-default-500">
                  for &ldquo;{qParam}&rdquo;
                  {totalPages > 1 && ` · page ${pageParam} of ${totalPages}`}
                </span>
              )}
            </div>

            {error && (
              <Alert
                color="danger"
                variant="flat"
                title="Search failed"
                description={error}
                className="mb-4"
              />
            )}

            {loading && <CardGridSkeleton count={12} />}

            {!loading && !error && results.length > 0 && (
              <>
                {renderSmallCards(results, 'q')}
                {totalPages > 1 && (
                  <div className="mb-4 mt-6 flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <Pagination
                      total={totalPages}
                      page={pageParam}
                      onChange={(p) => goPage(p)}
                      showControls
                      size="lg"
                      color="success"
                      variant="flat"
                    />
                  </div>
                )}
              </>
            )}

            {!loading && !error && hasQuery && results.length === 0 && (
              <Card shadow="none" className="border border-dashed border-default-300 bg-default-100/30">
                <CardBody className="py-10 text-center">
                  <p className="text-default-600">
                    No matches. Try another title or check spelling.
                  </p>
                </CardBody>
              </Card>
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
        <div className="bg-main flex h-full min-h-[50vh] w-full flex-col">
          <Header pageName="Search" />
          <div className="my-4 flex w-full flex-col px-4">
            <AllMoviesViewerLoading />
          </div>
        </div>
      }
    >
      <SearchContent />
    </Suspense>
  );
}
