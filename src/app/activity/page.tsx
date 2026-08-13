"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@heroui/react";
import Header from "@/components/ui/header";
import ExploreSectionTitle from "@/components/explore/exploreSectionTitle";
import WatchHistoryRail from "@/components/explore/watchHistoryRail";
import WatchHistoryLogRail from "@/components/explore/watchHistoryLogRail";
import {
  watchHistoryLogLabel,
  watchHistoryProgressLabel,
  WATCH_HISTORY_CHANGED_EVENT,
  WATCH_HISTORY_LOG_CHANGED_EVENT,
} from "@/lib/watchHistory";
import {
  fetchUserRailRows,
  fetchExploreHistoryRows,
  type ExploreHistoryRow,
} from "@/lib/explorePageData";
import { CONTENT_INSET_X } from "@/lib/contentInset";
import { RAIL_STACK_CLASS } from "@/lib/catalogGrid";
import { useAuth } from "@/contexts/authContext";
import { useUserData } from "@/contexts/userDataContext";

export default function ActivityPage() {
  const { user, loading: authLoading } = useAuth();
  const { watchHistoryEntries, watchHistoryLogEntries } = useUserData();
  const [historyRows, setHistoryRows] = useState<ExploreHistoryRow[]>([]);
  const [historyLogRows, setHistoryLogRows] = useState<ExploreHistoryRow[]>([]);

  const loadUserRails = useCallback(async () => {
    const continueIds = new Set(watchHistoryEntries.map((e) => e.catalogId));
    const logEntries = watchHistoryLogEntries.filter(
      (e) => !continueIds.has(e.catalogId)
    );
    const [rails, logRows] = await Promise.all([
      fetchUserRailRows({
        historyEntries: watchHistoryEntries,
        watchLaterEntries: [],
        favoriteEntries: [],
        progressLabel: watchHistoryProgressLabel,
      }),
      fetchExploreHistoryRows(logEntries, watchHistoryLogLabel),
    ]);
    setHistoryRows(rails.historyRows);
    setHistoryLogRows(logRows);
  }, [watchHistoryEntries, watchHistoryLogEntries]);

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
    window.addEventListener(WATCH_HISTORY_LOG_CHANGED_EVENT, onUserRailsChange);
    return () => {
      window.removeEventListener(WATCH_HISTORY_CHANGED_EVENT, onUserRailsChange);
      window.removeEventListener(WATCH_HISTORY_LOG_CHANGED_EVENT, onUserRailsChange);
    };
  }, [loadUserRails]);

  const isEmpty =
    historyRows.length === 0 && historyLogRows.length === 0;

  return (
    <div className="bg-main min-h-screen w-full">
      <Header pageName="Activity" />

      {isEmpty ? (
        <div className={`mt-8 max-w-2xl space-y-6 ${CONTENT_INSET_X}`}>
          <section className="space-y-2">
            <ExploreSectionTitle className="pl-0 text-lg" variant="explore">
              Continue watching
            </ExploreSectionTitle>
            <p className="text-sm text-default-500">
              Titles you play will show up here and on Explore.
            </p>
          </section>
          <section className="space-y-2">
            <ExploreSectionTitle className="pl-0 text-lg" variant="explore">
              Watch history
            </ExploreSectionTitle>
            <p className="text-sm text-default-500">
              A longer record of movies and shows you have watched.
            </p>
          </section>
          <p className="text-sm text-default-500">
            Favorites and watch later live in{" "}
            <Link href="/library" className="text-success hover:underline">
              Library
            </Link>
            .
          </p>
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

      <div className={`${RAIL_STACK_CLASS} ${CONTENT_INSET_X} mt-6 pb-12`}>
        {historyRows.length > 0 ? (
          <WatchHistoryRail items={historyRows} layout="profile" />
        ) : null}

        {historyLogRows.length > 0 ? (
          <WatchHistoryLogRail items={historyLogRows} layout="profile" />
        ) : null}
      </div>
    </div>
  );
}
