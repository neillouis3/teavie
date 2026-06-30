"use client";

import React from "react";
import { CatalogMediaPanelSkeleton } from "@/components/ui/catalogMediaPanel";
import {
  PlayerEmbedSkeleton,
  WatchPlayerShell,
} from "@/components/ui/playerEmbedSkeleton";

type WatchPageSkeletonProps = {
  withSeasonPicker?: boolean;
};

export default function WatchPageSkeleton({
  withSeasonPicker = false,
}: WatchPageSkeletonProps) {
  return (
    <div className="flex h-full w-full flex-col bg-background/92 px-0 pt-0 pb-32 dark:bg-background/88">
      <div className="flex w-full flex-col gap-6">
        <WatchPlayerShell>
          <PlayerEmbedSkeleton rounded="rounded-xl" />
        </WatchPlayerShell>
        <CatalogMediaPanelSkeleton withSeasonPicker={withSeasonPicker} />
      </div>
    </div>
  );
}
