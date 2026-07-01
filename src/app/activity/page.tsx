"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@heroui/react";
import Header from "@/components/ui/header";
import ExploreSectionTitle from "@/components/explore/exploreSectionTitle";
import WatchHistoryRail from "@/components/explore/watchHistoryRail";
import WatchLaterRail from "@/components/explore/watchLaterRail";
import FavoritesRail from "@/components/explore/favoritesRail";
import { watchHistoryProgressLabel, WATCH_HISTORY_CHANGED_EVENT } from "@/lib/watchHistory";
import { WATCH_LATER_CHANGED_EVENT } from "@/lib/watchLater";
import { FAVORITES_CHANGED_EVENT } from "@/lib/favorites";
import {
  fetchUserRailRows,
  type ExploreHistoryRow,
} from "@/lib/explorePageData";
import { CONTENT_INSET_X } from "@/lib/contentInset";
import { useAuth } from "@/contexts/authContext";
import { useUserData } from "@/contexts/userDataContext";
import type { ContentItem } from "@/types/content";

export default function ActivityPage() {
  const { user, loading: authLoading } = useAuth();
  const { watchHistoryEntries, watchLaterEntries, favoriteEntries } = useUserData();
  const [historyRows, setHistoryRows] = useState<ExploreHistoryRow[]>([]);
  const [watchLaterRows, setWatchLaterRows] = useState<ContentItem[]>([]);
  const [favoriteRows, setFavoriteRows] = useState<ContentItem[]>([]);

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
    setHistoryRows(rails.historyRows);
    setWatchLaterRows(rails.watchLaterRows);
    setFavoriteRows(rails.favoriteRows);
  }, [watchHistoryEntries, watchLaterEntries, favoriteEntries]);

  useEffect(() => {
    document.title = "Activity - Teavie";
  }, []);

  useEffect(() => {
    if (authLoading) return;
    void loadUserRails();
  }, [authLoading, loadUserRails]);

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

  const hasFavorites = favoriteEntries.length > 0;
  const isEmpty =
    historyRows.length === 0 &&
    favoriteRows.length === 0 &&
    watchLaterRows.length === 0 &&
    !hasFavorites;

  return (
    <div className="bg-main min-h-screen w-full">
      <Header pageName="Activity" />

      {isEmpty ? (
        <div className={`mt-8 max-w-2xl space-y-6 ${CONTENT_INSET_X}`}>
          <section className="space-y-2">
            <ExploreSectionTitle className="pl-0 text-lg" variant="explore">Continue watching</ExploreSectionTitle>
            <p className="text-sm text-default-500">
              Titles you play will show up here and on Explore.
            </p>
          </section>
          <section className="space-y-2">
            <ExploreSectionTitle className="pl-0 text-lg" variant="explore">Favorites</ExploreSectionTitle>
            <p className="text-sm text-default-500">
              Star titles from their detail page or catalog cards to build your list.
            </p>
          </section>
          <section className="space-y-2">
            <ExploreSectionTitle className="pl-0 text-lg" variant="explore">Watch later</ExploreSectionTitle>
            <p className="text-sm text-default-500">
              Save movies and shows from their detail page to build your list.
            </p>
          </section>
          {!user ? (
            <div className="flex flex-wrap gap-2 pt-2">
              <Button as={Link} href="/login" color="success" size="sm">
                Sign in
              </Button>
              <Button as={Link} href="/signup" variant="flat" size="sm">
                Create account
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}

      {historyRows.length > 0 ? (
        <div className={`mt-6 w-full ${CONTENT_INSET_X}`}>
          <WatchHistoryRail items={historyRows} layout="profile" />
        </div>
      ) : null}

      {favoriteRows.length > 0 ? (
        <div className={`mt-4 w-full ${CONTENT_INSET_X}`}>
          <FavoritesRail items={favoriteRows} layout="profile" />
        </div>
      ) : hasFavorites ? (
        <div className={`mt-8 max-w-2xl ${CONTENT_INSET_X}`}>
          <section className="space-y-2">
            <ExploreSectionTitle className="pl-0 text-lg" variant="explore">Favorites</ExploreSectionTitle>
            <p className="text-sm text-default-500">Loading your favorites…</p>
          </section>
        </div>
      ) : null}

      {watchLaterRows.length > 0 ? (
        <div className={`mt-4 w-full pb-12 ${CONTENT_INSET_X}`}>
          <WatchLaterRail items={watchLaterRows} layout="profile" />
        </div>
      ) : null}
    </div>
  );
}
