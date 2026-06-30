"use client";

import React, { useEffect, useState } from "react";
import PageSplash from "@/components/ui/pageSplash";
import CatalogRail from "@/components/catalog/catalogRail";
import TrendingHero from "@/components/catalog/trendingHero";
import ExploreSectionTitle from "@/components/explore/exploreSectionTitle";
import GenreRail from "@/components/explore/genreRail";
import WatchHistoryRail from "@/components/explore/watchHistoryRail";
import UpcomingRail from "@/components/explore/upcomingRail";
import NewContentRail from "@/components/explore/newContentRail";
import {
  loadExplorePagePayload,
  fetchExploreHistoryRows,
  projectExploreHistoryRows,
  type ExplorePagePayload,
  type TmdbDiscoverPayload,
} from "@/lib/explorePageData";
import {
  listWatchHistory,
  watchHistoryProgressLabel,
  WATCH_HISTORY_CHANGED_EVENT,
} from "@/lib/watchHistory";

export type { TmdbDiscoverPayload };

const SECTION_MAX_ITEMS = 24;

export default function ExploreHub() {
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
      setPayload((prev) => {
        if (!prev) return prev;
        if (historyEntries.length === 0) {
          return { ...prev, historyRows: [] };
        }
        const projected = projectExploreHistoryRows(
          prev.historyRows,
          historyEntries,
          watchHistoryProgressLabel
        );
        if (projected) {
          return { ...prev, historyRows: projected };
        }
        void fetchExploreHistoryRows(
          historyEntries,
          watchHistoryProgressLabel
        ).then((historyRows) => {
          setPayload((p) => (p ? { ...p, historyRows } : p));
        });
        return prev;
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
    return <PageSplash ariaLabel="Loading Explore" />;
  }

  const { discover, genres, historyRows, newContent, upcomingContent } = payload;
  const hasTrending =
    discover.trendingMovies.length > 0 || discover.trendingTv.length > 0;
  const hasPopular =
    discover.popularMovies.length > 0 || discover.popularTv.length > 0;
  const hasUpcoming = upcomingContent.length > 0;
  const hasNew = newContent.length > 0;

  return (
    <div className="flex w-full flex-col bg-background">
      {hasTrending && (
        <section
          className="relative mb-4 w-full max-w-full overflow-hidden"
          aria-label="Spotlight"
        >
          <TrendingHero
            variant="spotlight"
            bleedUnderNav
            showDots={false}
            trendingMovies={discover.trendingMovies}
            trendingTv={discover.trendingTv}
            maxItems={SECTION_MAX_ITEMS}
          />
        </section>
      )}

      <div className="mt-2 w-full pr-3 sm:pr-4">
        <WatchHistoryRail items={historyRows} />
        <GenreRail genres={genres} />
      </div>

      {hasPopular && (
        <div className="mt-6 flex w-full flex-col gap-12 pr-3 sm:pr-4">
          <div className="flex flex-col gap-10">
            <CatalogRail
              title="Popular movies"
              sectionTitleStyle="text"
              items={discover.popularMovies}
              maxItems={SECTION_MAX_ITEMS}
            />
            <CatalogRail
              title="Popular TV shows"
              sectionTitleStyle="text"
              items={discover.popularTv}
              maxItems={SECTION_MAX_ITEMS}
            />
          </div>
        </div>
      )}

      {(hasUpcoming || hasNew) && (
        <div className="mt-6 flex w-full flex-col gap-10 pr-3 pb-8 sm:pr-4">
          {hasUpcoming && (
            <section className="flex w-full flex-col gap-3" aria-label="New and upcoming">
              <ExploreSectionTitle>New &amp; upcoming</ExploreSectionTitle>
              <UpcomingRail items={upcomingContent} />
            </section>
          )}
          {hasNew && (
            <section className="flex w-full flex-col gap-3" aria-label="New on Teavie">
              <ExploreSectionTitle>New on Teavie</ExploreSectionTitle>
              <NewContentRail items={newContent} />
            </section>
          )}
        </div>
      )}
    </div>
  );
}
