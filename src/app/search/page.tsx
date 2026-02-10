'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Header from '@/components/ui/header';
import CustomInput from '@/components/ui/customInput';
import SmallCard from '@/components/ui/smallCard';
import { ContentItem } from '@/types/content';

function SearchContent() {
  const searchParams = useSearchParams();
  const q = searchParams.get('q') ?? '';

  const [results, setResults] = useState<ContentItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!q.trim()) {
      setResults([]);
      setTotal(0);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    fetch(`/api/search?q=${encodeURIComponent(q)}&limit=24`, { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : { results: [], total: 0 }))
      .then((data) => {
        setResults(data.results ?? []);
        setTotal(data.total ?? 0);
      })
      .catch((err) => {
        if (err.name !== 'AbortError') {
          setResults([]);
          setTotal(0);
        }
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [q]);

  const hasQuery = q.trim().length > 0;

  return (
    <div className="bg-main h-full w-full flex flex-col">
      <Header pageName="Search" />

      <div className="flex-col px-4 my-4">
        {/* Search bar row */}
        <div className="w-full flex flex-col gap-2 mb-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="w-full max-w-md">
            <CustomInput />
          </div>
        </div>

        {/* Intro when no query */}
        {!hasQuery && (
          <div className="flex flex-col items-center text-center mt-12">
            <img
              src="/textLogo.png"
              alt="logo"
              className="w-48 h-fit border-4 border-theme p-4 rounded-xl opacity-90"
            />
            <p className="text-white/80 mt-6 text-lg">Search for movies and TV shows</p>
          </div>
        )}

        {/* Results when there is a query */}
        {hasQuery && (
          <>
            <h1 className="text-xl text-white/90 w-full text-left mb-4">
              {loading ? 'Searching…' : total === 0 ? 'No results' : `Results for “${q}” (${total})`}
            </h1>

            {loading && (
              <div className="w-full grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 gap-4">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="h-96 rounded-xl bg-white/10 animate-pulse" />
                ))}
              </div>
            )}

            {!loading && results.length > 0 && (
              <div className="w-full grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 gap-4">
                {results.map((item, index) => {
                  const title = item.title || item.name || 'Untitled';
                  const year =
                    item.release_date?.split('-')[0] ||
                    item.first_air_date?.split('-')[0] ||
                    'N/A';
                  return (
                    <SmallCard
                      key={`${item.type}-${item.id}-${index}`}
                      id={typeof item.id === 'string' ? parseInt(item.id, 10) : item.id}
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
            )}

            {!loading && hasQuery && results.length === 0 && (
              <p className="text-white/60 mt-8">Try a different search term.</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="text-white/60 p-8">Loading search…</div>}>
      <SearchContent />
    </Suspense>
  );
}

