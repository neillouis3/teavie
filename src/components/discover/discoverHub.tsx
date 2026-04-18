"use client";

import React, { useEffect, useState } from "react";
import Header from "@/components/ui/header";
import CatalogRail from "@/components/explore/catalogRail";
import SmallCardLoading from "@/components/ui/smallCardLoading";
import HorizontalCatalogCardLoading from "@/components/ui/horizontalCatalogCardLoading";
import type { ContentItem } from "@/types/content";
import { useCatalogCardStyle } from "@/contexts/catalogCardStyleContext";
import {
  CATALOG_GRID_HORIZONTAL_SEARCH,
  CATALOG_GRID_VERTICAL_SEARCH,
} from "@/lib/catalogGrid";

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

function TmdbRailsSkeleton({ horizontal }: { horizontal: boolean }) {
  const gridClass = horizontal
    ? CATALOG_GRID_HORIZONTAL_SEARCH
    : CATALOG_GRID_VERTICAL_SEARCH;
  const tileCount = horizontal ? 8 : 14;
  return (
    <div className="flex w-full flex-col gap-8">
      {Array.from({ length: 2 }).map((_, section) => (
        <div key={section} className="flex flex-col gap-3">
          <div className="h-7 w-40 animate-pulse rounded-lg bg-default-200" />
          <div className={`${gridClass} items-start`}>
            {Array.from({ length: tileCount }).map((__, i) =>
              horizontal ? (
                <HorizontalCatalogCardLoading key={i} />
              ) : (
                <SmallCardLoading key={i} />
              )
            )}
          </div>
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

  useEffect(() => {
    document.title = "Discover - Teavie";
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

  const hasAny =
    data &&
    (data.trendingMovies.length > 0 ||
      data.trendingTv.length > 0 ||
      data.popularMovies.length > 0 ||
      data.popularTv.length > 0);

  const showDiscoverBody = loading || hasAny;

  return (
    <div className="bg-background flex w-full flex-col">
      <Header pageName="Discover" />

      {showDiscoverBody && (
        <div className="mt-6 flex w-full flex-col gap-12 px-3 pb-8 sm:px-4">
          {loading ? (
            <TmdbRailsSkeleton horizontal={horizontal} />
          ) : (
            data &&
            hasAny && (
              <div className="flex flex-col gap-10">
                <CatalogRail
                  title="Trending movies this week"
                  items={data.trendingMovies}
                  maxItems={14}
                  moreHref="/search"
                  moreLabel="Search & more"
                />
                <CatalogRail
                  title="Trending TV this week"
                  items={data.trendingTv}
                  maxItems={14}
                  moreHref="/search"
                  moreLabel="Search & more"
                />
                <CatalogRail
                  title="Popular movies"
                  items={data.popularMovies}
                  maxItems={14}
                  moreHref="/search"
                  moreLabel="Search & more"
                />
                <CatalogRail
                  title="Popular TV shows"
                  items={data.popularTv}
                  maxItems={14}
                  moreHref="/search"
                  moreLabel="Search & more"
                />
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}
