"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@heroui/react";
import ExploreSectionTitle from "@/components/explore/exploreSectionTitle";
import WatchHistoryRail from "@/components/explore/watchHistoryRail";
import WatchHistoryLogRail from "@/components/explore/watchHistoryLogRail";
import UserPageShell from "@/components/ui/userPageShell";
import {
  watchHistoryLogLabel,
  watchHistoryProgressLabel,
  WATCH_HISTORY_CHANGED_EVENT,
  WATCH_HISTORY_LOG_CHANGED_EVENT,
} from "@/lib/watchHistory";
import {
  fetchUserRailRows,
  fetchExploreHistoryRows,
  peekExploreHistoryRows,
  exploreHistoryRowsMatch,
  historyRowsCoverEntries,
  type ExploreHistoryRow,
} from "@/lib/explorePageData";
import { readClientDayCache, writeClientDayCache } from "@/lib/clientDayCache";
import { RAIL_INNER_CLASS, RAIL_STACK_CLASS } from "@/lib/catalogGrid";
import { CatalogRailSkeleton } from "@/components/catalog/catalogRail";
import { useAuth } from "@/contexts/authContext";
import { useUserData } from "@/contexts/userDataContext";

const ACTIVITY_CACHE_PREFIX = "teavie.cache.activity.v3:";

type ActivityPayload = {
  historyRows: ExploreHistoryRow[];
  historyLogRows: ExploreHistoryRow[];
};

function listSignature(entries: { catalogId: string; mediaType: string }[]) {
  return entries.map((e) => `${e.mediaType}:${e.catalogId}`).sort().join("|");
}

export default function ActivityPage() {
  const { user } = useAuth();
  const { watchHistoryEntries, watchHistoryLogEntries } = useUserData();

  const cacheKey = useMemo(() => {
    const continueIds = new Set(watchHistoryEntries.map((e) => e.catalogId));
    const logEntries = watchHistoryLogEntries.filter(
      (e) => !continueIds.has(e.catalogId)
    );
    return `${ACTIVITY_CACHE_PREFIX}${listSignature(watchHistoryEntries)}::${listSignature(logEntries)}`;
  }, [watchHistoryEntries, watchHistoryLogEntries]);

  const [historyRows, setHistoryRows] = useState<ExploreHistoryRow[]>(() => {
    if (typeof window === "undefined") return [];
    return readClientDayCache<ActivityPayload>(cacheKey)?.historyRows ?? [];
  });
  const [historyLogRows, setHistoryLogRows] = useState<ExploreHistoryRow[]>(() => {
    if (typeof window === "undefined") return [];
    return readClientDayCache<ActivityPayload>(cacheKey)?.historyLogRows ?? [];
  });
  const [loading, setLoading] = useState(() => {
    if (typeof window === "undefined") return true;
    return false;
  });
  const [loadFailed, setLoadFailed] = useState(false);

  const logEntries = useMemo(() => {
    const continueIds = new Set(watchHistoryEntries.map((e) => e.catalogId));
    return watchHistoryLogEntries.filter((e) => !continueIds.has(e.catalogId));
  }, [watchHistoryEntries, watchHistoryLogEntries]);

  const hasLocalHistory =
    watchHistoryEntries.length > 0 || logEntries.length > 0;

  const loadUserRails = useCallback(async () => {
    const hasPending = hasLocalHistory;
    const cached = readClientDayCache<ActivityPayload>(cacheKey);
    const peekedHistory = peekExploreHistoryRows(
      watchHistoryEntries,
      watchHistoryProgressLabel
    );
    const peekedLog = peekExploreHistoryRows(logEntries, watchHistoryLogLabel);
    const cacheComplete =
      hasPending &&
      historyRowsCoverEntries(peekedHistory, watchHistoryEntries) &&
      historyRowsCoverEntries(peekedLog, logEntries);

    if (cacheComplete) {
      setHistoryRows((prev) =>
        exploreHistoryRowsMatch(prev, peekedHistory) ? prev : peekedHistory
      );
      setHistoryLogRows((prev) =>
        exploreHistoryRowsMatch(prev, peekedLog) ? prev : peekedLog
      );
      setLoading(false);
      setLoadFailed(false);
      return;
    }

    if (hasPending) {
      setLoading(true);
    }
    setLoadFailed(false);
    try {
      const [rails, logRows] = await Promise.all([
        fetchUserRailRows({
          historyEntries: watchHistoryEntries,
          watchLaterEntries: [],
          favoriteEntries: [],
          progressLabel: watchHistoryProgressLabel,
        }),
        fetchExploreHistoryRows(logEntries, watchHistoryLogLabel),
      ]);
      setHistoryRows((prev) =>
        exploreHistoryRowsMatch(prev, rails.historyRows) ? prev : rails.historyRows
      );
      setHistoryLogRows((prev) =>
        exploreHistoryRowsMatch(prev, logRows) ? prev : logRows
      );
      const loaded = rails.historyRows.length > 0 || logRows.length > 0;
      setLoadFailed(hasPending && !loaded);
      if (loaded) {
        writeClientDayCache(cacheKey, {
          historyRows: rails.historyRows,
          historyLogRows: logRows,
        });
      }
    } catch {
      setLoadFailed(hasPending);
      if (peekedHistory.length > 0 || peekedLog.length > 0) {
        setHistoryRows((prev) =>
          exploreHistoryRowsMatch(prev, peekedHistory) ? prev : peekedHistory
        );
        setHistoryLogRows((prev) =>
          exploreHistoryRowsMatch(prev, peekedLog) ? prev : peekedLog
        );
      }
    } finally {
      setLoading(false);
    }
  }, [cacheKey, watchHistoryEntries, logEntries, hasLocalHistory]);

  useEffect(() => {
    document.title = "Activity - Teavie";
  }, []);

  useEffect(() => {
    void loadUserRails();
  }, [cacheKey, loadUserRails]);

  useEffect(() => {
    const onUserRailsChange = () => void loadUserRails();
    window.addEventListener(WATCH_HISTORY_CHANGED_EVENT, onUserRailsChange);
    window.addEventListener(WATCH_HISTORY_LOG_CHANGED_EVENT, onUserRailsChange);
    return () => {
      window.removeEventListener(WATCH_HISTORY_CHANGED_EVENT, onUserRailsChange);
      window.removeEventListener(WATCH_HISTORY_LOG_CHANGED_EVENT, onUserRailsChange);
    };
  }, [loadUserRails]);

  const isEmpty = !hasLocalHistory && !loading && historyRows.length === 0 && historyLogRows.length === 0;
  const showLoading =
    hasLocalHistory && loading && historyRows.length === 0 && historyLogRows.length === 0;

  return (
    <UserPageShell
      title="Activity"
      description="Continue watching and your watch history."
      backdrop="activity"
      contentMaxWidth="6xl"
      contentClassName="flex flex-col items-center"
    >
      {isEmpty ? (
        <div className="flex w-full max-w-lg flex-col items-center space-y-8 text-center">
          <section className="space-y-2">
            <ExploreSectionTitle
              className="justify-center text-lg text-white"
              variant="explore"
            >
              Continue watching
            </ExploreSectionTitle>
            <p className="text-sm text-white/50">
              Titles you play will show up here and on Explore.
            </p>
          </section>
          <section className="space-y-2">
            <ExploreSectionTitle
              className="justify-center text-lg text-white"
              variant="explore"
            >
              Watch history
            </ExploreSectionTitle>
            <p className="text-sm text-white/50">
              A longer record of movies and shows you have watched.
            </p>
          </section>
          <p className="text-sm text-white/50">
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
      ) : showLoading ? (
        <div className={`${RAIL_STACK_CLASS} w-full items-center`}>
          <section className={RAIL_INNER_CLASS} aria-label="Continue watching" aria-busy="true">
            <ExploreSectionTitle className="justify-center" variant="explore">
              Continue watching
            </ExploreSectionTitle>
            <CatalogRailSkeleton count={6} />
          </section>
        </div>
      ) : loadFailed ? (
        <div className="flex w-full max-w-lg flex-col items-center space-y-4 text-center">
          <p className="text-sm text-white/50">
            Couldn&apos;t load your activity.{" "}
            <button
              type="button"
              className="text-success hover:underline"
              onClick={() => void loadUserRails()}
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
