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
  type ExploreHistoryRow,
} from "@/lib/explorePageData";
import { readClientDayCache, writeClientDayCache } from "@/lib/clientDayCache";
import { RAIL_STACK_CLASS } from "@/lib/catalogGrid";
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
    const cached = readClientDayCache<ActivityPayload>(cacheKey);
    return !(cached && (cached.historyRows.length > 0 || cached.historyLogRows.length > 0));
  });
  const loadUserRails = useCallback(async () => {
    const continueIds = new Set(watchHistoryEntries.map((e) => e.catalogId));
    const logEntries = watchHistoryLogEntries.filter(
      (e) => !continueIds.has(e.catalogId)
    );
    const hasPending =
      watchHistoryEntries.length > 0 || logEntries.length > 0;
    const cached = readClientDayCache<ActivityPayload>(cacheKey);
    const peekedHistory = peekExploreHistoryRows(
      watchHistoryEntries,
      watchHistoryProgressLabel
    );
    const peekedLog = peekExploreHistoryRows(logEntries, watchHistoryLogLabel);
    const cacheComplete =
      hasPending &&
      peekedHistory.length === watchHistoryEntries.length &&
      peekedLog.length === logEntries.length;

    if (cacheComplete) {
      setHistoryRows((prev) =>
        exploreHistoryRowsMatch(prev, peekedHistory) ? prev : peekedHistory
      );
      setHistoryLogRows((prev) =>
        exploreHistoryRowsMatch(prev, peekedLog) ? prev : peekedLog
      );
      setLoading(false);
      return;
    }

    if (
      hasPending &&
      !(cached?.historyRows.length || cached?.historyLogRows.length)
    ) {
      setLoading(true);
    }
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
      if (loaded) {
        writeClientDayCache(cacheKey, {
          historyRows: rails.historyRows,
          historyLogRows: logRows,
        });
      }
    } catch {
      if (peekedHistory.length > 0 || peekedLog.length > 0) {
        setHistoryRows((prev) =>
          exploreHistoryRowsMatch(prev, peekedHistory) ? prev : peekedHistory
        );
        setHistoryLogRows((prev) =>
          exploreHistoryRowsMatch(prev, peekedLog) ? prev : peekedLog
        );
      } else {
        setHistoryRows([]);
        setHistoryLogRows([]);
      }
    } finally {
      setLoading(false);
    }
  }, [cacheKey, watchHistoryEntries, watchHistoryLogEntries]);

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

  const isEmpty =
    !loading && historyRows.length === 0 && historyLogRows.length === 0;

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
