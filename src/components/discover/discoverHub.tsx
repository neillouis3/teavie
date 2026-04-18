"use client";

import React, { useEffect, useState } from "react";
import Header from "@/components/ui/header";
import CatalogRail from "@/components/explore/catalogRail";
import SmallCardLoading from "@/components/ui/smallCardLoading";
import { Chip } from "@heroui/react";
import type { ContentItem } from "@/types/content";

export type TmdbDiscoverPayload = {
  trendingMovies: ContentItem[];
  trendingTv: ContentItem[];
  popularMovies: ContentItem[];
  popularTv: ContentItem[];
};

const EMPTY: TmdbDiscoverPayload = {
  trendingMovies: [],
  trendingTv: [],
  popularMovies: [],
  popularTv: [],
};

function TmdbRailsSkeleton() {
  return (
    <div className="flex w-full flex-col gap-8">
      {Array.from({ length: 2 }).map((_, section) => (
        <div key={section} className="flex flex-col gap-3">
          <div className="h-7 w-40 animate-pulse rounded-lg bg-default-200" />
          <div className="grid w-full grid-cols-3 gap-2 sm:gap-4 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-6">
            {Array.from({ length: 6 }).map((__, i) => (
              <SmallCardLoading key={i} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function DiscoverHub() {
  const [data, setData] = useState<TmdbDiscoverPayload | null>(null);
  const [newMovies, setNewMovies] = useState<ContentItem[]>([]);
  const [upcomingMovies, setUpcomingMovies] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    document.title = "Discover - Teavie";
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      fetch("/api/tmdb/discover").then((res) => res.json()),
      fetch("/api/new?limit=12&type=movie").then((res) => res.json()),
      fetch("/api/upcoming?limit=12&type=movie").then((res) => res.json()),
    ])
      .then(([discoverJson, newJson, upcomingJson]) => {
        if (cancelled) return;
        setData({
          trendingMovies: discoverJson.trendingMovies ?? [],
          trendingTv: discoverJson.trendingTv ?? [],
          popularMovies: discoverJson.popularMovies ?? [],
          popularTv: discoverJson.popularTv ?? [],
        });
        setNewMovies(newJson.results ?? []);
        setUpcomingMovies(upcomingJson.results ?? []);
      })
      .catch(() => {
        if (!cancelled) {
          setData(EMPTY);
          setNewMovies([]);
          setUpcomingMovies([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const hasAny =
    data &&
    (data.trendingMovies.length > 0 ||
      data.trendingTv.length > 0 ||
      data.popularMovies.length > 0 ||
      data.popularTv.length > 0);

  const hasCatalogRails = newMovies.length > 0 || upcomingMovies.length > 0;
  const showDiscoverBody = loading || hasCatalogRails || hasAny;

  return (
    <div className="bg-background flex w-full flex-col">
      <Header pageName="Discover" />

      {showDiscoverBody && (
        <div className="mt-6 flex w-full flex-col gap-12 px-3 pb-8 sm:px-4">
          {loading ? (
            <TmdbRailsSkeleton />
          ) : (
            <>
              {hasCatalogRails ? (
                <div className="flex flex-col gap-10">
                  <div className="mb-1">
                    <Chip color="success" size="md" radius="sm">
                      New & upcoming movies
                    </Chip>
                    <p className="mt-1 text-xs text-default-500">
                      From your catalog (last 30 days new, next month upcoming). Run the daily TMDB sync
                      so titles stay fresh.
                    </p>
                  </div>
                  <CatalogRail
                    title="New in theaters & streaming"
                    items={newMovies}
                    moreHref="/explore"
                    moreLabel="Explore"
                  />
                  <CatalogRail
                    title="Coming soon (movies)"
                    items={upcomingMovies}
                    moreHref="/explore"
                    moreLabel="Explore"
                  />
                </div>
              ) : null}

              {data && hasAny ? (
                <div className="flex flex-col gap-10">
                  <CatalogRail
                    title="Trending movies this week"
                    items={data.trendingMovies}
                    moreHref="/search"
                    moreLabel="Search & more"
                  />
                  <CatalogRail
                    title="Trending TV this week"
                    items={data.trendingTv}
                    moreHref="/search"
                    moreLabel="Search & more"
                  />
                  <CatalogRail
                    title="Popular movies"
                    items={data.popularMovies}
                    moreHref="/search"
                    moreLabel="Search & more"
                  />
                  <CatalogRail
                    title="Popular TV shows"
                    items={data.popularTv}
                    moreHref="/search"
                    moreLabel="Search & more"
                  />
                </div>
              ) : null}
            </>
          )}
        </div>
      )}
    </div>
  );
}
