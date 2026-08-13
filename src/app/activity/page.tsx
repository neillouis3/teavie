"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@heroui/react";
import ExploreSectionTitle from "@/components/explore/exploreSectionTitle";
import WatchHistoryRail from "@/components/explore/watchHistoryRail";
import WatchHistoryLogRail from "@/components/explore/watchHistoryLogRail";
import UserPageShell from "@/components/ui/userPageShell";
import SmallCardLoading from "@/components/ui/smallCardLoading";
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
import { readClientDayCache, writeClientDayCache } from "@/lib/clientDayCache";
import { LIBRARY_GRID_CLASS, RAIL_INNER_CLASS, RAIL_STACK_CLASS } from "@/lib/catalogGrid";
import { useAuth } from "@/contexts/authContext";
import { useUserData } from "@/contexts/userDataContext";

const ACTIVITY_CACHE_PREFIX = "teavie.cache.activity.v2:";

/** Reserve one grid row while cards load — reduces CLS when data arrives. */
const ACTIVITY_GRID_MIN_H = "min-h-[420px] sm:min-h-[460px]";

type ActivityPayload = {
  historyRows: ExploreHistoryRow[];
  historyLogRows: ExploreHistoryRow[];
};

function listSignature(entries: { catalogId: string; mediaType: string }[]) {
  return entries.map((e) => `${e.mediaType}:${e.catalogId}`).sort().join("|");
}

function ActivityGridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className={LIBRARY_GRID_CLASS} aria-hidden>
      {Array.from({ length: count }).map((_, i) => (
        <SmallCardLoading key={i} />
      ))}
    </div>
  );
}

function ActivitySection({
  title,
  busy,
  children,
}: {
  title: string;
  busy?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section
      className={`${RAIL_INNER_CLASS} ${ACTIVITY_GRID_MIN_H} w-full items-center`}
      aria-busy={busy || undefined}
    >
      <ExploreSectionTitle
        className="justify-center text-lg text-white"
        variant="explore"
      >
        {title}
      </ExploreSectionTitle>
      {children}
    </section>
  );
}

export default function ActivityPage() {
  const { user, loading: authLoading } = useAuth();
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
      setHistoryRows(rails.historyRows);
      setHistoryLogRows(logRows);
      if (rails.historyRows.length > 0 || logRows.length > 0) {
        writeClientDayCache(cacheKey, {
          historyRows: rails.historyRows,
          historyLogRows: logRows,
        });
      }
    } finally {
      setLoading(false);
    }
  }, [cacheKey, watchHistoryEntries, watchHistoryLogEntries]);

  useEffect(() => {
    document.title = "Activity - Teavie";
  }, []);

  useEffect(() => {
    if (authLoading) return;
    const cached = readClientDayCache<ActivityPayload>(cacheKey);
    if (cached) {
      setHistoryRows(cached.historyRows);
      setHistoryLogRows(cached.historyLogRows);
      if (cached.historyRows.length > 0 || cached.historyLogRows.length > 0) {
        setLoading(false);
      }
    }
    void loadUserRails();
  }, [authLoading, cacheKey, loadUserRails]);

  useEffect(() => {
    const onUserRailsChange = () => void loadUserRails();
    window.addEventListener(WATCH_HISTORY_CHANGED_EVENT, onUserRailsChange);
    window.addEventListener(WATCH_HISTORY_LOG_CHANGED_EVENT, onUserRailsChange);
    return () => {
      window.removeEventListener(WATCH_HISTORY_CHANGED_EVENT, onUserRailsChange);
      window.removeEventListener(WATCH_HISTORY_LOG_CHANGED_EVENT, onUserRailsChange);
    };
  }, [loadUserRails]);

  const continueIds = useMemo(
    () => new Set(watchHistoryEntries.map((e) => e.catalogId)),
    [watchHistoryEntries]
  );
  const pendingLogCount = watchHistoryLogEntries.filter(
    (e) => !continueIds.has(e.catalogId)
  ).length;
  const hasContinue =
    watchHistoryEntries.length > 0 || historyRows.length > 0;
  const hasHistoryLog = pendingLogCount > 0 || historyLogRows.length > 0;
  const isEmpty = !loading && !hasContinue && !hasHistoryLog;
  const showContinueSection = hasContinue || (loading && watchHistoryEntries.length > 0);
  const showHistorySection = hasHistoryLog || (loading && pendingLogCount > 0);

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
          {showContinueSection ? (
            historyRows.length > 0 ? (
              <WatchHistoryRail
                items={historyRows}
                layout="profile"
                bleed={false}
                display="grid"
              />
            ) : (
              <ActivitySection title="Continue watching" busy>
                <ActivityGridSkeleton count={4} />
              </ActivitySection>
            )
          ) : null}

          {showHistorySection ? (
            historyLogRows.length > 0 ? (
              <WatchHistoryLogRail
                items={historyLogRows}
                layout="profile"
                bleed={false}
                display="grid"
              />
            ) : (
              <ActivitySection title="Watch history" busy>
                <ActivityGridSkeleton count={4} />
              </ActivitySection>
            )
          ) : null}
        </div>
      )}
    </UserPageShell>
  );
}
