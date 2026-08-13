"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
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
  peekExploreInitialCore,
  fetchUserRailRows,
  fetchExploreBundle,
  fetchPersonalizedExploreBundle,
  applyPersonalizedToCore,
  projectExploreHistoryRows,
  buildSpotlightItems,
  type ExploreCorePayload,
  type ExplorePagePayload,
  type TmdbDiscoverPayload,
  type UserRailRows,
} from "@/lib/explorePageData";
import { hasUserPreferences } from "@/types/user";
import { useResumeFetchWhenVisible } from "@/hooks/useResumeFetchWhenVisible";
import { watchHistoryProgressLabel, WATCH_HISTORY_CHANGED_EVENT } from "@/lib/watchHistory";
import { useUserData } from "@/contexts/userDataContext";
import { MOBILE_CONTENT_INSET_LEFT } from "@/lib/contentInset";

export type { TmdbDiscoverPayload };

import {
  EXPLORE_RAIL_MAX_ITEMS,
  RAIL_AFTER_SPOTLIGHT,
  RAIL_INNER_CLASS,
  RAIL_STACK_CLASS,
} from "@/lib/catalogGrid";

const SECTION_MAX_ITEMS = EXPLORE_RAIL_MAX_ITEMS;

const EMPTY_RAILS: UserRailRows = {
  historyRows: [],
  watchLaterRows: [],
  favoriteRows: [],
};

function historySignature(
  entries: { catalogId: string; mediaType: string; lastSeason: number; lastEpisode: number }[]
) {
  return entries
    .map((e) => `${e.mediaType}:${e.catalogId}:s${e.lastSeason}e${e.lastEpisode}`)
    .sort()
    .join("|");
}

export default function ExploreHub() {
  const { preferences, watchHistoryEntries, watchedMovieIds } = useUserData();
  const [core, setCore] = useState<ExploreCorePayload | null>(() =>
    peekExploreInitialCore(preferences, watchedMovieIds)
  );
  const [userRails, setUserRails] = useState<UserRailRows>(EMPTY_RAILS);
  const [userRailsLoading, setUserRailsLoading] = useState(
    () => watchHistoryEntries.length > 0
  );
  const [awaitingPersonalized, setAwaitingPersonalized] = useState(
    () =>
      hasUserPreferences(preferences) &&
      (peekExploreInitialCore(preferences, watchedMovieIds)?.recommendedRows.length ?? 0) === 0
  );

  const preferencesSig = useMemo(() => JSON.stringify(preferences), [preferences]);
  const watchedMoviesSig = useMemo(
    () => [...watchedMovieIds].sort().join("|"),
    [watchedMovieIds]
  );
  const historySig = useMemo(
    () => historySignature(watchHistoryEntries),
    [watchHistoryEntries]
  );

  const loadUserRails = useCallback(async () => {
    if (watchHistoryEntries.length === 0) {
      setUserRails(EMPTY_RAILS);
      setUserRailsLoading(false);
      return;
    }
    setUserRailsLoading(true);
    try {
      const rails = await fetchUserRailRows({
        historyEntries: watchHistoryEntries,
        watchLaterEntries: [],
        favoriteEntries: [],
        progressLabel: watchHistoryProgressLabel,
      });
      setUserRails(rails);
    } finally {
      setUserRailsLoading(false);
    }
  }, [watchHistoryEntries]);

  const payload = useMemo<ExplorePagePayload | null>(
    () => (core ? { ...core, ...userRails } : null),
    [core, userRails]
  );

  const spotlightItems = useMemo(
    () =>
      core
        ? buildSpotlightItems(
            core.discover.trendingMovies,
            core.discover.trendingTv,
            preferences,
            SECTION_MAX_ITEMS
          )
        : [],
    [core, preferencesSig, preferences]
  );

  const loadShell = useCallback(() => {
    void loadExploreCoreShell().then(setCore);
  }, []);

  const bustCoreInflight = useCallback(() => {
    bustExploreCoreInflight(preferences, watchedMovieIds);
  }, [preferences, watchedMovieIds]);

  useEffect(() => {
    document.title = "Explore - Teavie";
  }, []);

  useEffect(() => {
    let cancelled = false;
    const wantsPersonalized = hasUserPreferences(preferences);

    void (async () => {
      const [shell, bundle, personalized] = await Promise.all([
        loadExploreCoreShell(),
        fetchExploreBundle(),
        wantsPersonalized
          ? fetchPersonalizedExploreBundle(preferences, watchedMovieIds, false)
          : Promise.resolve(null),
      ]);

      if (cancelled) return;

      const nextCore =
        wantsPersonalized && personalized
          ? applyPersonalizedToCore(
              shell,
              bundle,
              personalized,
              preferences,
              watchedMovieIds
            )
          : shell;

      setCore(nextCore);
      setAwaitingPersonalized(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [preferencesSig, watchedMoviesSig, preferences, watchedMovieIds]);

  useResumeFetchWhenVisible(!core, loadShell, bustCoreInflight);

  useEffect(() => {
    void loadUserRails();
  }, [historySig, loadUserRails]);

  useEffect(() => {
    const onHistoryChange = () => void loadUserRails();
    window.addEventListener(WATCH_HISTORY_CHANGED_EVENT, onHistoryChange);
    return () => {
      window.removeEventListener(WATCH_HISTORY_CHANGED_EVENT, onHistoryChange);
    };
  }, [loadUserRails]);

  useEffect(() => {
    const refreshHistory = () => {
      setUserRails((prev) => {
        if (watchHistoryEntries.length === 0) {
          return { ...prev, historyRows: [] };
        }
        const projected = projectExploreHistoryRows(
          prev.historyRows,
          watchHistoryEntries,
          watchHistoryProgressLabel
        );
        if (projected) {
          return { ...prev, historyRows: projected };
        }
        void loadUserRails();
        return prev;
      });
    };

    window.addEventListener(WATCH_HISTORY_CHANGED_EVENT, refreshHistory);
    return () => {
      window.removeEventListener(WATCH_HISTORY_CHANGED_EVENT, refreshHistory);
    };
  }, [watchHistoryEntries, loadUserRails]);

  if (!core || !payload) {
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
          <CatalogRailSkeleton count={8} />
          <CatalogRailSkeleton count={8} />
          <CatalogRailSkeleton count={8} />
        </div>
      </div>
    );
  }

  const {
    discover,
    genres,
    historyRows,
    recommendedRows,
    newContent,
    upcomingContent,
  } = payload;
  const hasTrending = spotlightItems.length > 0;
  const hasPopular =
    discover.popularMovies.length > 0 || discover.popularTv.length > 0;
  const hasUpcoming = upcomingContent.length > 0;
  const hasNew = newContent.length > 0;
  const hasRecommended = recommendedRows.length > 0;
  const showRecommendedSlot =
    hasUserPreferences(preferences) && (awaitingPersonalized || hasRecommended);

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
        {watchHistoryEntries.length > 0 ? (
          userRailsLoading && historyRows.length === 0 ? (
            <section
              className={cn(RAIL_INNER_CLASS, "min-h-[280px]")}
              aria-label="Continue watching"
              aria-busy="true"
            >
              <ExploreSectionTitle variant="explore">Continue watching</ExploreSectionTitle>
              <CatalogRailSkeleton count={6} />
            </section>
          ) : historyRows.length > 0 ? (
            <WatchHistoryRail items={historyRows} maxItems={SECTION_MAX_ITEMS} />
          ) : null
        ) : null}
        {showRecommendedSlot ? (
          awaitingPersonalized && !hasRecommended ? (
            <CatalogRailSkeleton count={6} />
          ) : (
            <CatalogRail
              title="Recommended for you"
              items={recommendedRows}
              maxItems={SECTION_MAX_ITEMS}
              titleVariant="explore"
            />
          )
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
