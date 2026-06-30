'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@heroui/react';
import { fetchCatalogStats, type CatalogStatsPayload } from '@/lib/pageDataCache';

export default function HomePage() {
  const router = useRouter();
  const [stats, setStats] = useState<CatalogStatsPayload | null>(null);

  useEffect(() => {
    document.title = 'Teavie - Watch Movies & TV Shows';
  }, []);

  useEffect(() => {
    let cancelled = false;
    void fetchCatalogStats().then((data) => {
      if (!cancelled) setStats(data);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="flex min-h-[calc(100dvh-3.5rem)] w-full flex-col items-center justify-center bg-main pr-4 py-12 sm:pr-8 sm:py-24 lg:min-h-screen">
      <div className="flex w-full max-w-lg flex-col items-center justify-center sm:max-w-2xl">
        <div className="flex w-full flex-col items-center justify-center text-center">
          <img
            src="/lightLogo.png"
            alt="Teavie"
            className="h-auto w-full max-w-xs rounded-xl p-2 dark:hidden sm:max-w-md sm:p-4"
          />
          <img
            src="/darkLogo.png"
            alt="Teavie"
            className="hidden h-auto w-full max-w-xs rounded-xl p-2 dark:block sm:max-w-md sm:p-4"
          />

          {stats && stats.total > 0 ? (
            <div className="mt-6 space-y-1 text-sm text-default-500">
              <p>
                <span className="font-medium text-foreground">
                  {stats.total.toLocaleString()}
                </span>{' '}
                titles in the catalog
              </p>
              <p className="text-xs text-default-400">
                {stats.movies.toLocaleString()} movies · {stats.tv.toLocaleString()} TV
                shows · {stats.anime.toLocaleString()} anime ·{' '}
                {stats.kdrama.toLocaleString()} K-drama
              </p>
            </div>
          ) : null}

          <Button
            color="success"
            className="mt-8 sm:mt-10"
            onPress={() => router.push('/explore')}
          >
            Go Explore The Site
          </Button>
          <p className="mt-10 text-xs text-default-500">
            Designed and built by{" "}
            <a
              href="https://x.com/neillouis3dev"
              target="_blank"
              rel="noopener noreferrer"
              className="text-default-400 underline underline-offset-2 hover:text-default-300"
            >
              @neillouis3dev
            </a>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
