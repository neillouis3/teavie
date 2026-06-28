"use client";

import React, { useEffect, useState } from "react";
import Header from "@/components/ui/header";
import CatalogRail, { CatalogRailSkeleton } from "@/components/explore/catalogRail";
import TrendingHeroViewer from "@/components/explore/trendingHeroViewer";
import TrendingHeroLoading from "@/components/explore/trendingHeroLoading";
import GenreDiscover from "@/components/discover/genreDiscover";
import WatchHistoryRail from "@/components/explore/watchHistoryRail";
import type { ContentItem } from "@/types/content";
import { useCatalogCardStyle } from "@/contexts/catalogCardStyleContext";

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

const TRENDING_SECTION_MIN_H = "min-h-[52vh] sm:min-h-[62vh] lg:min-h-[80vh]";

function PopularRailsSkeleton({ horizontal }: { horizontal: boolean }) {
  return (
    <div className="flex w-full flex-col gap-8">
      {Array.from({ length: 2 }).map((_, section) => (
        <div key={section} className="flex flex-col gap-3">
          <div className="h-7 w-40 animate-pulse rounded-lg bg-default-200" />
          <CatalogRailSkeleton horizontal={horizontal} count={horizontal ? 6 : 10} />
        </div>
      ))}
    </div>
  );
}

export default function DiscoverHub() {
  const [data, setData] = useState<TmdbDiscoverPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const { mode: cardLayout } = useCatalogCardStyle();
  const horizontal = cardLayout === "horizontal";
  const sectionMaxItems = 24;

  useEffect(() => {
    document.title = "Explore - Teavie";
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch("/api/tmdb/discover")
      .then((res) => res.json())
      .then((discoverJson) => {
        if (cancelled) return;
        setData({
          trendingMovies: discoverJson.trendingMovies ?? [],
          trendingTv: discoverJson.trendingTv ?? [],
          popularMovies: discoverJson.popularMovies ?? [],
          popularTv: discoverJson.popularTv ?? [],
        });
      })
      .catch(() => {
        if (!cancelled) setData(EMPTY);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const hasTrending =
    data &&
    (data.trendingMovies.length > 0 || data.trendingTv.length > 0);

  const hasPopular =
    data &&
    (data.popularMovies.length > 0 || data.popularTv.length > 0);

  const showTrendingHero = loading || hasTrending;
  const showPopularRails = loading || hasPopular;

  return (
    <div className="bg-background flex w-full flex-col">
      <Header pageName="Explore" />

      {showTrendingHero && (
        <section
          className={`mb-4 mt-4 flex w-full flex-col ${TRENDING_SECTION_MIN_H}`}
          aria-label="Trending"
        >
          {loading ? (
            <TrendingHeroLoading />
          ) : (
            data && (
              <TrendingHeroViewer
                trendingMovies={data.trendingMovies}
                trendingTv={data.trendingTv}
                maxItems={sectionMaxItems}
              />
            )
          )}
        </section>
      )}

      <div className="mt-2 w-full px-3 sm:px-4">
        <WatchHistoryRail />
        <GenreDiscover />
      </div>

      {showPopularRails && (
        <div className="mt-6 flex w-full flex-col gap-12 px-3 pb-8 sm:px-4">
          {loading ? (
            <PopularRailsSkeleton horizontal={horizontal} />
          ) : (
            data &&
            hasPopular && (
              <div className="flex flex-col gap-10">
                <CatalogRail
                  title="Popular movies"
                  items={data.popularMovies}
                  maxItems={sectionMaxItems}
                />
                <CatalogRail
                  title="Popular TV shows"
                  items={data.popularTv}
                  maxItems={sectionMaxItems}
                />
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}
