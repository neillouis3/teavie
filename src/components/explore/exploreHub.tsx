"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import PageSplash from "@/components/ui/pageSplash";
import CatalogRail from "@/components/catalog/catalogRail";
import TrendingHero from "@/components/catalog/trendingHero";
import { cn } from "@/lib/utils";
import ExploreSectionTitle from "@/components/explore/exploreSectionTitle";
import GenreRail from "@/components/explore/genreRail";
import WatchHistoryRail from "@/components/explore/watchHistoryRail";
import WatchLaterRail from "@/components/explore/watchLaterRail";
import FavoritesRail from "@/components/explore/favoritesRail";
import UpcomingRail from "@/components/explore/upcomingRail";
import NewContentRail from "@/components/explore/newContentRail";
import {
  loadExploreCorePayload,
  bustExploreCoreInflight,
  fetchUserRailRows,
  projectExploreHistoryRows,
  buildSpotlightItems,
  type ExploreCorePayload,
  type ExplorePagePayload,
  type TmdbDiscoverPayload,
  type UserRailRows,
} from "@/lib/explorePageData";
import { useResumeFetchWhenVisible } from "@/hooks/useResumeFetchWhenVisible";
import { watchHistoryProgressLabel, WATCH_HISTORY_CHANGED_EVENT } from "@/lib/watchHistory";
import { WATCH_LATER_CHANGED_EVENT } from "@/lib/watchLater";
import { FAVORITES_CHANGED_EVENT } from "@/lib/favorites";
import { useAuth } from "@/contexts/authContext";
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

function listSignature(entries: { catalogId: string; mediaType: string }[]) {
  return entries.map((e) => `${e.mediaType}:${e.catalogId}`).sort().join("|");
}

export default function ExploreHub() {
  const { loading: authLoading, profileLoading, user } = useAuth();
  const { preferences, watchHistoryEntries, watchLaterEntries, favoriteEntries, watchedMovieIds } =
    useUserData();
  const [core, setCore] = useState<ExploreCorePayload | null>(null);
  const [userRails, setUserRails] = useState<UserRailRows>(EMPTY_RAILS);

  const preferencesSig = useMemo(() => JSON.stringify(preferences), [preferences]);
  const watchedMoviesSig = useMemo(
    () => [...watchedMovieIds].sort().join("|"),
    [watchedMovieIds]
  );
  const historySig = useMemo(
    () => historySignature(watchHistoryEntries),
    [watchHistoryEntries]
  );
  const watchLaterSig = useMemo(
    () => listSignature(watchLaterEntries),
    [watchLaterEntries]
  );
  const favoritesSig = useMemo(
    () => listSignature(favoriteEntries),
    [favoriteEntries]
  );

  const loadUserRails = useCallback(async () => {
    const rails = await fetchUserRailRows({
      historyEntries: watchHistoryEntries,
      watchLaterEntries: watchLaterEntries.map((e) => ({
        catalogId: e.catalogId,
        mediaType: e.mediaType,
      })),
      favoriteEntries: favoriteEntries.map((e) => ({
        catalogId: e.catalogId,
        mediaType: e.mediaType,
      })),
      progressLabel: watchHistoryProgressLabel,
    });
    setUserRails(rails);
  }, [watchHistoryEntries, watchLaterEntries, favoriteEntries]);

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

  const loadCore = useCallback(() => {
    if (authLoading) return;
    if (user && profileLoading) return;
    void loadExploreCorePayload(preferences, {
      excludeMovieIds: watchedMovieIds,
    }).then(setCore);
  }, [
    authLoading,
    profileLoading,
    user,
    preferences,
    watchedMovieIds,
  ]);

  const bustCoreInflight = useCallback(() => {
    bustExploreCoreInflight(preferences, watchedMovieIds);
  }, [preferences, watchedMovieIds]);

  useEffect(() => {
    document.title = "Explore - Teavie";
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (user && profileLoading) return;
    let cancelled = false;
    void loadExploreCorePayload(preferences, {
      excludeMovieIds: watchedMovieIds,
    }).then((nextCore) => {
      if (!cancelled) setCore(nextCore);
    });
    return () => {
      cancelled = true;
    };
  }, [
    authLoading,
    profileLoading,
    user,
    preferencesSig,
    watchedMoviesSig,
    preferences,
    watchedMovieIds,
  ]);

  useResumeFetchWhenVisible(!core, loadCore, bustCoreInflight);

  useEffect(() => {
    if (authLoading) return;
    void loadUserRails();
  }, [authLoading, historySig, watchLaterSig, favoritesSig, loadUserRails]);

  useEffect(() => {
    const onUserRailsChange = () => void loadUserRails();
    window.addEventListener(WATCH_HISTORY_CHANGED_EVENT, onUserRailsChange);
    window.addEventListener(WATCH_LATER_CHANGED_EVENT, onUserRailsChange);
    window.addEventListener(FAVORITES_CHANGED_EVENT, onUserRailsChange);
    return () => {
      window.removeEventListener(WATCH_HISTORY_CHANGED_EVENT, onUserRailsChange);
      window.removeEventListener(WATCH_LATER_CHANGED_EVENT, onUserRailsChange);
      window.removeEventListener(FAVORITES_CHANGED_EVENT, onUserRailsChange);
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
    return <PageSplash ariaLabel="Loading Explore" />;
  }

  const {
    discover,
    genres,
    historyRows,
    watchLaterRows,
    favoriteRows,
    recommendedRows,
    newContent,
    upcomingContent,
  } = payload;
  const hasTrending = spotlightItems.length > 0;
  const hasPopular =
    discover.popularMovies.length > 0 || discover.popularTv.length > 0;
  const hasUpcoming = upcomingContent.length > 0;
  const hasNew = newContent.length > 0;
  const hasWatchLater = watchLaterRows.length > 0;
  const hasFavorites = favoriteRows.length > 0;
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
        <WatchHistoryRail items={historyRows} maxItems={SECTION_MAX_ITEMS} />
        {hasRecommended ? (
          <CatalogRail
            title="Recommended for you"
            items={recommendedRows}
            maxItems={SECTION_MAX_ITEMS}
            titleVariant="explore"
          />
        ) : null}
        {hasWatchLater ? (
          <WatchLaterRail items={watchLaterRows} maxItems={SECTION_MAX_ITEMS} />
        ) : null}
        {hasFavorites ? (
          <FavoritesRail items={favoriteRows} maxItems={SECTION_MAX_ITEMS} />
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
