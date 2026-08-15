"use client";

import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
} from "react";
import CatalogRail, { CatalogRailSkeleton } from "@/components/catalog/catalogRail";
import TrendingHero, { SPOTLIGHT_SKELETON_H } from "@/components/catalog/trendingHero";
import { cn } from "@/lib/utils";
import ExploreSectionTitle from "@/components/explore/exploreSectionTitle";
import GenreRail from "@/components/explore/genreRail";
import WatchHistoryRail from "@/components/explore/watchHistoryRail";
import UpcomingRail from "@/components/explore/upcomingRail";
import NewContentRail from "@/components/explore/newContentRail";
import {
  loadExploreCoreShell,
  bustExploreCoreInflight,
  peekExploreCoreCache,
  isUsableExploreCore,
  fetchPersonalizedExploreBundle,
  peekPersonalizedExploreCache,
  peekPersonalizedExploreSession,
  buildSpotlightItems,
  type ExploreCorePayload,
  type TmdbDiscoverPayload,
} from "@/lib/explorePageData";
import { seedExploreBundleCache } from "@/lib/pageDataCache";
import { hasUserPreferences } from "@/types/user";
import { useResumeFetchWhenVisible } from "@/hooks/useResumeFetchWhenVisible";
import { useContinueWatchingRows } from "@/hooks/useContinueWatchingRows";
import { useUserData } from "@/contexts/userDataContext";
import { MOBILE_CONTENT_INSET_LEFT } from "@/lib/contentInset";
import type { ContentItem } from "@/types/content";

export type { TmdbDiscoverPayload };

import {
  EXPLORE_RAIL_MAX_ITEMS,
  RAIL_AFTER_SPOTLIGHT,
  RAIL_INNER_CLASS,
  RAIL_STACK_CLASS,
} from "@/lib/catalogGrid";

const SECTION_MAX_ITEMS = EXPLORE_RAIL_MAX_ITEMS;

function seedCacheFromCore(core: ExploreCorePayload): void {
  seedExploreBundleCache({
    discover: core.discover,
    genres: core.genres,
    feed: {
      newContent: core.newContent,
      updatedContent: [],
      upcomingContent: core.upcomingContent,
    },
  });
}

export default function ExploreHub({
  initialCore = null,
}: {
  initialCore?: ExploreCorePayload | null;
}) {
  const { preferences, watchHistoryEntries, watchedMovieIds } = useUserData();
  const [core, setCore] = useState<ExploreCorePayload | null>(initialCore);
  const [recommendedRows, setRecommendedRows] = useState<ContentItem[]>([]);

  const {
    rows: historyRows,
    failed: historyFailed,
    reload: reloadHistory,
  } = useContinueWatchingRows(watchHistoryEntries);

  const loadShell = useCallback(() => {
    void loadExploreCoreShell().then((shell) => {
      setCore((prev) => (isUsableExploreCore(prev) ? prev : shell));
    });
  }, []);

  useLayoutEffect(() => {
    if (initialCore && isUsableExploreCore(initialCore)) {
      seedCacheFromCore(initialCore);
      setCore((prev) => prev ?? initialCore);
      return;
    }
    const peeked = peekExploreCoreCache();
    if (peeked) setCore((prev) => prev ?? peeked);
  }, [initialCore]);

  const bustCoreInflight = useCallback(() => {
    bustExploreCoreInflight(null, []);
  }, []);

  useEffect(() => {
    document.title = "Explore - Teavie";
  }, []);

  useEffect(() => {
    if (isUsableExploreCore(core)) return;
    let cancelled = false;
    void loadExploreCoreShell().then((shell) => {
      if (cancelled) return;
      setCore((prev) => (isUsableExploreCore(prev) ? prev : shell));
      if (isUsableExploreCore(shell)) seedCacheFromCore(shell);
    });
    return () => {
      cancelled = true;
    };
  }, [core]);

  useResumeFetchWhenVisible(!isUsableExploreCore(core), loadShell, bustCoreInflight);

  useLayoutEffect(() => {
    if (!hasUserPreferences(preferences)) {
      setRecommendedRows([]);
      return;
    }
    const peeked =
      peekPersonalizedExploreSession(preferences, watchedMovieIds, true) ??
      peekPersonalizedExploreCache(preferences, watchedMovieIds);
    if (peeked?.recommended?.length) {
      setRecommendedRows(peeked.recommended);
    }
  }, [preferences, watchedMovieIds]);

  useEffect(() => {
    if (!hasUserPreferences(preferences)) {
      setRecommendedRows([]);
      return;
    }
    let cancelled = false;
    void fetchPersonalizedExploreBundle(preferences, watchedMovieIds, true).then(
      (bundle) => {
        if (cancelled) return;
        setRecommendedRows(bundle?.recommended ?? []);
      }
    );
    return () => {
      cancelled = true;
    };
  }, [preferences, watchedMovieIds]);

  const spotlightItems = useMemo(
    () =>
      core
        ? buildSpotlightItems(
            core.discover.trendingMovies,
            core.discover.trendingTv,
            null,
            SECTION_MAX_ITEMS
          )
        : [],
    [core]
  );

  const continueWatchingSection =
    watchHistoryEntries.length > 0 ? (
      historyRows.length > 0 ? (
        <WatchHistoryRail items={historyRows} maxItems={SECTION_MAX_ITEMS} />
      ) : historyFailed ? (
        <section className={RAIL_INNER_CLASS} aria-label="Continue watching">
          <ExploreSectionTitle variant="explore">Continue watching</ExploreSectionTitle>
          <p className="text-sm text-default-500">
            Couldn&apos;t load your titles.{" "}
            <button
              type="button"
              className="text-success hover:underline"
              onClick={() => void reloadHistory()}
            >
              Try again
            </button>
          </p>
        </section>
      ) : (
        <section
          className={cn(RAIL_INNER_CLASS, "min-h-[280px]")}
          aria-label="Continue watching"
          aria-busy="true"
        >
          <ExploreSectionTitle variant="explore">Continue watching</ExploreSectionTitle>
          <CatalogRailSkeleton count={6} />
        </section>
      )
    ) : null;

  if (!core) {
    return (
      <div className="flex w-full flex-col bg-background">
        <section
          className={cn(
            "relative z-0 -mt-14 w-full overflow-hidden rounded-tl-2xl",
            RAIL_AFTER_SPOTLIGHT
          )}
          aria-hidden
        >
          <div
            className={cn(
              "animate-pulse bg-default-200 dark:bg-default-100/10",
              SPOTLIGHT_SKELETON_H
            )}
          />
        </section>
        <div className={cn(RAIL_STACK_CLASS, MOBILE_CONTENT_INSET_LEFT, "pb-8")}>
          {continueWatchingSection}
          <CatalogRailSkeleton count={8} />
          <CatalogRailSkeleton count={8} />
          <CatalogRailSkeleton count={8} />
        </div>
      </div>
    );
  }

  const { discover, genres, newContent, upcomingContent } = core;
  const hasTrending = spotlightItems.length > 0;
  const hasPopular =
    discover.popularMovies.length > 0 || discover.popularTv.length > 0;
  const hasUpcoming = upcomingContent.length > 0;
  const hasNew = newContent.length > 0;
  const hasRecommended = recommendedRows.length > 0;

  return (
    <div className="flex w-full flex-col bg-background">
      {hasTrending && (
        <section
          className={cn(
            "relative z-0 -mt-14 w-full overflow-hidden rounded-tl-2xl",
            RAIL_AFTER_SPOTLIGHT
          )}
          aria-label="Spotlight"
        >
          <TrendingHero
            variant="spotlight"
            bleedUnderNav
            showDots={false}
            trendingMovies={discover.trendingMovies}
            trendingTv={discover.trendingTv}
            spotlightItems={spotlightItems}
            maxItems={SECTION_MAX_ITEMS}
          />
        </section>
      )}

      <div
        className={cn(
          RAIL_STACK_CLASS,
          MOBILE_CONTENT_INSET_LEFT,
          "pb-8",
          hasTrending ? "mt-0" : "mt-2"
        )}
      >
        {continueWatchingSection}
        {hasRecommended ? (
          <CatalogRail
            title="Recommended for you"
            items={recommendedRows}
            maxItems={SECTION_MAX_ITEMS}
            titleVariant="explore"
          />
        ) : null}
        <GenreRail genres={genres} preferredGenreSlugs={preferences.genres} />
        {hasPopular ? (
          <CatalogRail
            title="Popular Movies"
            items={discover.popularMovies}
            maxItems={SECTION_MAX_ITEMS}
            titleVariant="explore"
          />
        ) : null}
        {hasPopular ? (
          <CatalogRail
            title="Popular TV Shows"
            items={discover.popularTv}
            maxItems={SECTION_MAX_ITEMS}
            titleVariant="explore"
          />
        ) : null}
        {hasUpcoming ? (
          <section className={RAIL_INNER_CLASS} aria-label="New and Upcoming">
            <ExploreSectionTitle variant="explore">New and Upcoming</ExploreSectionTitle>
            <UpcomingRail items={upcomingContent} />
          </section>
        ) : null}
        {hasNew ? (
          <section className={RAIL_INNER_CLASS} aria-label="New on Teavie">
            <ExploreSectionTitle variant="explore">New on Teavie</ExploreSectionTitle>
            <NewContentRail items={newContent} />
          </section>
        ) : null}
      </div>
    </div>
  );
}
