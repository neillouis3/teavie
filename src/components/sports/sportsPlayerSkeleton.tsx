"use client";

import React from "react";
import { WatchPlayerShell } from "@/components/ui/playerEmbedSkeleton";

function PanelSkeleton() {
  return (
    <div className="w-full space-y-4" aria-hidden>
      <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
        <div className="space-y-2">
          <div className="h-7 w-48 animate-pulse rounded bg-default-200 dark:bg-white/10" />
          <div className="h-4 w-32 animate-pulse rounded bg-default-200 dark:bg-white/10" />
        </div>
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="h-9 w-24 animate-pulse rounded-full bg-default-200 dark:bg-white/10"
            />
          ))}
        </div>
      </div>
      <div className="h-20 w-full animate-pulse rounded-xl bg-default-200 dark:bg-white/10" />
    </div>
  );
}

/** Loading shell for sports player — video shell + match panel below. */
export default function SportsPlayerSkeleton() {
  return (
    <div className="flex h-full w-full flex-col bg-background/92 px-0 pt-0 pb-32 dark:bg-background/88">
      <div className="flex w-full flex-col gap-6">
        <WatchPlayerShell>
          <div className="relative h-full min-h-0 w-full animate-pulse rounded-xl bg-default-200 dark:bg-default-100/20" />
        </WatchPlayerShell>
        <PanelSkeleton />
      </div>
    </div>
  );
}
