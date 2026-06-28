"use client";

import React, { useEffect, useState } from "react";
import Header from "@/components/ui/header";
import CatalogRail from "@/components/explore/catalogRail";
import TrendingHeroViewer from "@/components/explore/trendingHeroViewer";
import GenreDiscover from "@/components/discover/genreDiscover";
import WatchHistoryRail from "@/components/explore/watchHistoryRail";
import ExplorePageSplash from "@/components/explore/explorePageSplash";
import {
  loadExplorePagePayload,
  fetchExploreHistoryRows,
  type ExplorePagePayload,
  type TmdbDiscoverPayload,
} from "@/lib/explorePageData";
import {
  listWatchHistory,
  watchHistoryProgressLabel,
  WATCH_HISTORY_CHANGED_EVENT,
} from "@/lib/watchHistory";

export type { TmdbDiscoverPayload };

const TRENDING_SECTION_MIN_H = "min-h-[52vh] sm:min-h-[62vh] lg:min-h-[80vh]";
const SECTION_MAX_ITEMS = 24;

export default function DiscoverHub() {
  const [payload, setPayload] = useState<ExplorePagePayload | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    document.title = "Explore - Teavie";
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const historyEntries = listWatchHistory();
      const data = await loadExplorePagePayload(
        historyEntries,
        watchHistoryProgressLabel
      );
      if (cancelled) return;
      setPayload(data);
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const onHistoryChange = () => {
      const historyEntries = listWatchHistory();
      void fetchExploreHistoryRows(
        historyEntries,
        watchHistoryProgressLabel
      ).then((historyRows) => {
        setPayload((prev) =>
          prev ? { ...prev, historyRows } : prev
        );
      });
    };
    window.addEventListener(WATCH_HISTORY_CHANGED_EVENT, onHistoryChange);
    window.addEventListener("storage", onHistoryChange);
    return () => {
      window.removeEventListener(WATCH_HISTORY_CHANGED_EVENT, onHistoryChange);
      window.removeEventListener("storage", onHistoryChange);
    };
  }, []);

  if (!ready || !payload) {
    return <ExplorePageSplash />;
  }

  const { discover, genres, historyRows } = payload;
  const hasTrending =
    discover.trendingMovies.length > 0 || discover.trendingTv.length > 0;
  const hasPopular =
    discover.popularMovies.length > 0 || discover.popularTv.length > 0;

  return (
    <div className="bg-background flex w-full flex-col">
      <Header pageName="Explore" />

      {hasTrending && (
        <section
          className={`mb-4 mt-4 flex w-full flex-col ${TRENDING_SECTION_MIN_H}`}
          aria-label="Trending"
        >
          <TrendingHeroViewer
            trendingMovies={discover.trendingMovies}
            trendingTv={discover.trendingTv}
            maxItems={SECTION_MAX_ITEMS}
          />
        </section>
      )}

      <div className="mt-2 w-full px-3 sm:px-4">
        <WatchHistoryRail items={historyRows} />
        <GenreDiscover genres={genres} />
      </div>

      {hasPopular && (
        <div className="mt-6 flex w-full flex-col gap-12 px-3 pb-8 sm:px-4">
          <div className="flex flex-col gap-10">
            <CatalogRail
              title="Popular movies"
              items={discover.popularMovies}
              maxItems={SECTION_MAX_ITEMS}
            />
            <CatalogRail
              title="Popular TV shows"
              items={discover.popularTv}
              maxItems={SECTION_MAX_ITEMS}
            />
          </div>
        </div>
      )}
    </div>
  );
}
