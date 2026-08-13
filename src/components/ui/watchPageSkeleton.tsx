"use client";

import React from "react";
import { CatalogMediaPanelSkeleton } from "@/components/ui/catalogMediaPanel";
import {
  PlayerEmbedSkeleton,
  WatchPlayerShell,
} from "@/components/ui/playerEmbedSkeleton";
import { SHOW_CONTENT_INSET_X } from "@/lib/contentInset";

type WatchPageSkeletonProps = {
  withSeasonPicker?: boolean;
};

/** Loading shell for movie + show watch pages (player first). */
export default function WatchPageSkeleton({
  withSeasonPicker = false,
}: WatchPageSkeletonProps) {
  return (
    <div className="flex h-full w-full flex-col bg-background/92 px-0 pt-0 pb-32 dark:bg-background/88">
      <div className={`flex w-full flex-col gap-6 ${SHOW_CONTENT_INSET_X}`}>
        <WatchPlayerShell>
          <PlayerEmbedSkeleton rounded="rounded-xl" />
        </WatchPlayerShell>
        <CatalogMediaPanelSkeleton withSeasonPicker={withSeasonPicker} />
      </div>
    </div>
  );
}

/** Full-viewport loading shell for immersive movie watch. */
export function ImmersiveWatchPageSkeleton() {
  return (
    <div className="fixed inset-0 z-0 flex h-[100dvh] w-full bg-black">
      <PlayerEmbedSkeleton rounded="rounded-none" className="h-full w-full" />
    </div>
  );
}
