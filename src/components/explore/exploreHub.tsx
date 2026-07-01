"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import PageSplash from "@/components/ui/pageSplash";
import CatalogRail from "@/components/catalog/catalogRail";
import TrendingHero, { EXPLORE_SPOTLIGHT_RESERVE } from "@/components/catalog/trendingHero";
import { SPOTLIGHT_SHELL_WIDTH, SIDEBAR_SYNC_TRANSITION } from "@/components/ui/sidebarBleedRail";
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
  fetchUserRailRows,
  projectExploreHistoryRows,
  buildSpotlightItems,
  type ExploreCorePayload,
  type ExplorePagePayload,
  type TmdbDiscoverPayload,
  type UserRailRows,
} from "@/lib/explorePageData";
import { watchHistoryProgressLabel, WATCH_HISTORY_CHANGED_EVENT } from "@/lib/watchHistory";
import { WATCH_LATER_CHANGED_EVENT } from "@/lib/watchLater";
import { FAVORITES_CHANGED_EVENT } from "@/lib/favorites";
import { useAuth } from "@/contexts/authContext";
import { useUserData } from "@/contexts/userDataContext";
import { MOBILE_CONTENT_INSET_LEFT } from "@/lib/contentInset";

export type { TmdbDiscoverPayload };

const SECTION_MAX_ITEMS = 24;

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
  const { loading: authLoading } = useAuth();
  const { preferences, watchHistoryEntries, watchLaterEntries, favoriteEntries } =
    useUserData();
  const [core, setCore] = useState<ExploreCorePayload | null>(null);
  const [userRails, setUserRails] = useState<UserRailRows>(EMPTY_RAILS);

  const preferencesSig = useMemo(() => JSON.stringify(preferences), [preferences]);
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

  useEffect(() => {
    document.title = "Explore - Teavie";
  }, []);

  useEffect(() => {
    if (authLoading) return;
    let cancelled = false;
    void loadExploreCorePayload(preferences).then((nextCore) => {
      if (!cancelled) setCore(nextCore);
    });
    return () => {
      cancelled = true;
    };
  }, [authLoading, preferencesSig]);

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
            "relative z-0 -mt-2 mb-4 w-full overflow-x-visible overflow-y-hidden",
            "lg:absolute lg:left-[calc(-1*var(--sidebar-w,16rem))] lg:top-0 lg:mb-0",
            SIDEBAR_SYNC_TRANSITION,
            SPOTLIGHT_SHELL_WIDTH,
            "h-[calc(80vh+4.5rem)]"
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
          `w-full ${MOBILE_CONTENT_INSET_LEFT}`,
          hasTrending ? cn("mt-2", EXPLORE_SPOTLIGHT_RESERVE) : "mt-2"
        )}
      >
        <WatchHistoryRail items={historyRows} />
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
      </div>

      {hasPopular && (
        <div className={`mt-6 flex w-full flex-col gap-12 ${MOBILE_CONTENT_INSET_LEFT}`}>
          <div className="flex flex-col gap-10">
            <CatalogRail
              title="Popular movies"
              items={discover.popularMovies}
              maxItems={SECTION_MAX_ITEMS}
              titleVariant="explore"
            />
            <CatalogRail
              title="Popular TV shows"
              items={discover.popularTv}
              maxItems={SECTION_MAX_ITEMS}
              titleVariant="explore"
            />
          </div>
        </div>
      )}

      {(hasUpcoming || hasNew) && (
        <div className={`mt-6 flex w-full flex-col gap-10 pb-8 ${MOBILE_CONTENT_INSET_LEFT}`}>
          {hasUpcoming && (
            <section className="flex w-full flex-col gap-3" aria-label="New and upcoming">
              <ExploreSectionTitle variant="explore">New & upcoming</ExploreSectionTitle>
              <UpcomingRail items={upcomingContent} />
            </section>
          )}
          {hasNew && (
            <section className="flex w-full flex-col gap-3" aria-label="New on Teavie">
              <ExploreSectionTitle variant="explore">New on Teavie</ExploreSectionTitle>
              <NewContentRail items={newContent} />
            </section>
          )}
        </div>
      )}
    </div>
  );
}
