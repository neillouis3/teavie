"use client";

import React, { useEffect, useMemo } from "react";
import Link from "next/link";
import { Button } from "@heroui/react";
import ExploreSectionTitle from "@/components/explore/exploreSectionTitle";
import WatchHistoryRail from "@/components/explore/watchHistoryRail";
import WatchHistoryLogRail from "@/components/explore/watchHistoryLogRail";
import UserPageShell from "@/components/ui/userPageShell";
import { watchHistoryLogLabel } from "@/lib/watchHistory";
import { RAIL_STACK_CLASS } from "@/lib/catalogGrid";
import { PAGE_BODY } from "@/lib/pageLayout";
import { useAuth } from "@/contexts/authContext";
import { useUserData } from "@/contexts/userDataContext";
import { useContinueWatchingRows } from "@/hooks/useContinueWatchingRows";

export default function ActivityPage() {
  const { user } = useAuth();
  const { watchHistoryEntries, watchHistoryLogEntries } = useUserData();

  const logEntries = useMemo(() => {
    const continueIds = new Set(watchHistoryEntries.map((e) => e.catalogId));
    return watchHistoryLogEntries.filter((e) => !continueIds.has(e.catalogId));
  }, [watchHistoryEntries, watchHistoryLogEntries]);

  const {
    rows: historyRows,
    loading: continueLoading,
    failed: continueFailed,
    reload: reloadContinue,
  } = useContinueWatchingRows(watchHistoryEntries);

  const {
    rows: historyLogRows,
    loading: logLoading,
    failed: logFailed,
    reload: reloadLog,
  } = useContinueWatchingRows(logEntries, watchHistoryLogLabel);

  const hasLocalHistory =
    watchHistoryEntries.length > 0 || logEntries.length > 0;
  const hasRows = historyRows.length > 0 || historyLogRows.length > 0;
  const stillLoading = hasLocalHistory && (continueLoading || logLoading) && !hasRows;
  const loadFailed =
    hasLocalHistory && !stillLoading && (continueFailed || logFailed) && !hasRows;

  useEffect(() => {
    document.title = "Activity - Teavie";
  }, []);

  const isEmpty = !hasLocalHistory && !stillLoading && !loadFailed && !hasRows;

  const retry = () => {
    void reloadContinue();
    void reloadLog();
  };

  return (
    <UserPageShell
      title="Activity"
      description="Continue watching and your watch history."
      backdrop="activity"
      contentMaxWidth="6xl"
      contentClassName="flex flex-col items-center"
    >
      {isEmpty ? (
        <div className="flex w-full max-w-lg flex-col items-center gap-8 text-center">
          <section className="space-y-2">
            <ExploreSectionTitle className="justify-center" variant="explore">
              Continue watching
            </ExploreSectionTitle>
            <p className={PAGE_BODY}>
              Titles you play will show up here and on Explore.
            </p>
          </section>
          <section className="space-y-2">
            <ExploreSectionTitle className="justify-center" variant="explore">
              Watch history
            </ExploreSectionTitle>
            <p className={PAGE_BODY}>
              A longer record of movies and shows you have watched.
            </p>
          </section>
          <p className={PAGE_BODY}>
            Favorites and watch later live in{" "}
            <Link href="/library" className="text-success hover:underline">
              Library
            </Link>
            .
          </p>
          {!user ? (
            <div className="flex flex-wrap justify-center gap-2 pt-2">
              <Button as={Link} href="/login" color="success" size="sm">
                Sign in
              </Button>
              <Button as={Link} href="/signup" variant="flat" size="sm">
                Create account
              </Button>
            </div>
          ) : null}
        </div>
      ) : loadFailed ? (
        <div className="flex w-full max-w-lg flex-col items-center gap-4 text-center">
          <p className={PAGE_BODY}>
            Couldn&apos;t load your activity.{" "}
            <button
              type="button"
              className="text-success hover:underline"
              onClick={retry}
            >
              Try again
            </button>
          </p>
        </div>
      ) : (
        <div className={`${RAIL_STACK_CLASS} w-full items-center`}>
          {historyRows.length > 0 ? (
            <WatchHistoryRail
              items={historyRows}
              layout="profile"
              bleed={false}
              display="grid"
            />
          ) : null}
          {historyLogRows.length > 0 ? (
            <WatchHistoryLogRail
              items={historyLogRows}
              layout="profile"
              bleed={false}
              display="grid"
            />
          ) : null}
        </div>
      )}
    </UserPageShell>
  );
}
