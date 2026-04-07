'use client';

import React, { useState, useEffect, Suspense, useCallback } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { Input, Button, Chip } from '@heroui/react';
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import SmallCard from '@/components/ui/smallCard';
import { ContentItem } from '@/types/content';

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

    fetch(
      `/api/search?q=${encodeURIComponent(q)}&page=${pageParam}`,
      { signal: controller.signal }
    )
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

  return (
    <div className="bg-background flex min-h-full w-full flex-col px-4 py-6 pb-32">
      <div className="mx-auto w-full max-w-6xl">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Search
        </h1>
        <p className="mt-1 text-sm text-default-500">
          Find movies and TV by title
        </p>

        <form onSubmit={submitSearch} className="mt-6 flex w-full flex-col gap-3 sm:flex-row sm:items-center">
          <Input
            aria-label="Search query"
            placeholder="Search movies and shows…"
            value={inputValue}
            onValueChange={setInputValue}
            size="lg"
            variant="bordered"
            classNames={{
              input: 'text-base',
              inputWrapper: 'bg-default-100/50',
            }}
            startContent={
              <MagnifyingGlassIcon className="h-5 w-5 text-default-400" />
            }
          />
          <Button
            type="submit"
            color="success"
            size="lg"
            className="shrink-0 font-semibold sm:min-w-[120px]"
          >
            Search
          </Button>
        </form>

        {!hasQuery && (
          <div className="mt-10 space-y-10">
            <p className="text-sm text-default-500">
              Or browse popular picks below — same TMDB data as search results.
            </p>

            {popularError && (
              <p className="rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
                {popularError}
              </p>
            )}

            {popularLoading && (
              <div className="space-y-6">
                {['Movies', 'TV'].map((label) => (
                  <div key={label}>
                    <div className="mb-3 h-6 w-32 animate-pulse rounded bg-default-200" />
                    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <div
                          key={i}
                          className="h-96 animate-pulse rounded-xl bg-default-200"
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {!popularLoading && !popularError && (
              <>
                <section>
                  <h2 className="mb-4 text-lg font-semibold text-foreground">
                    Popular movies
                  </h2>
                  {popularMovies.length === 0 ? (
                    <p className="text-sm text-default-500">No titles to show.</p>
                  ) : (
                    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                      {popularMovies.map((item, index) => {
                        const title = item.title || item.name || 'Untitled';
                        const year =
                          item.release_date?.split('-')[0] ||
                          item.first_air_date?.split('-')[0] ||
                          '—';
                        return (
                          <SmallCard
                            key={`pop-m-${item.id}-${index}`}
                            id={item.id}
                            title={title}
                            year={year}
                            type="movie"
                            runtimeSeconds={item.runtimeSeconds ?? undefined}
                            seasonAmount={item.season_amount ?? 0}
                            posterPath={item.poster_path || ''}
                          />
                        );
                      })}
                    </div>
                  )}
                </section>

                <section>
                  <h2 className="mb-4 text-lg font-semibold text-foreground">
                    Popular TV
                  </h2>
                  {popularTv.length === 0 ? (
                    <p className="text-sm text-default-500">No titles to show.</p>
                  ) : (
                    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                      {popularTv.map((item, index) => {
                        const title = item.title || item.name || 'Untitled';
                        const year =
                          item.release_date?.split('-')[0] ||
                          item.first_air_date?.split('-')[0] ||
                          '—';
                        return (
                          <SmallCard
                            key={`pop-tv-${item.id}-${index}`}
                            id={item.id}
                            title={title}
                            year={year}
                            type="tv"
                            runtimeSeconds={item.runtimeSeconds ?? undefined}
                            seasonAmount={item.season_amount ?? 0}
                            posterPath={item.poster_path || ''}
                          />
                        );
                      })}
                    </div>
                  )}
                </section>
              </>
            )}
          </div>
        )}

        {hasQuery && (
          <div className="mt-8">
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <Chip size="sm" variant="flat" color="success">
                {loading ? 'Searching…' : `${total} result${total === 1 ? '' : 's'}`}
              </Chip>
              {!loading && (
                <span className="text-sm text-default-500">
                  for &ldquo;{qParam}&rdquo;
                  {totalPages > 1 && ` · page ${pageParam} of ${totalPages}`}
                </span>
              )}
            </div>

            {error && (
              <p className="rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
                {error}
              </p>
            )}

            {loading && (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                {Array.from({ length: 10 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-96 animate-pulse rounded-xl bg-default-200"
                  />
                ))}
              </div>
            )}

            {!loading && !error && results.length > 0 && (
              <>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                  {results.map((item, index) => {
                    const title = item.title || item.name || 'Untitled';
                    const year =
                      item.release_date?.split('-')[0] ||
                      item.first_air_date?.split('-')[0] ||
                      '—';
                    return (
                      <SmallCard
                        key={`${item.type}-${item.id}-${index}`}
                        id={
                          typeof item.id === 'string'
                            ? parseInt(item.id, 10)
                            : item.id
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

                {totalPages > 1 && (
                  <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
                    <Button
                      size="sm"
                      variant="flat"
                      isDisabled={pageParam <= 1}
                      onPress={() => goPage(pageParam - 1)}
                    >
                      Previous
                    </Button>
                    <span className="text-sm text-default-500">
                      Page {pageParam} / {totalPages}
                    </span>
                    <Button
                      size="sm"
                      variant="flat"
                      isDisabled={pageParam >= totalPages}
                      onPress={() => goPage(pageParam + 1)}
                    >
                      Next
                    </Button>
                  </div>
                )}
              </>
            )}

            {!loading && !error && hasQuery && results.length === 0 && (
              <p className="mt-6 text-default-500">
                No matches. Try another title or check spelling.
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
        <div className="bg-background text-default-500 flex min-h-[40vh] items-center justify-center p-8">
          Loading search…
        </div>
      }
    >
      <SearchContent />
    </Suspense>
  );
}
