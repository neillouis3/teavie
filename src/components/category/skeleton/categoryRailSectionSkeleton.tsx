"use client";

import React from "react";
import { CatalogRailSkeleton } from "@/components/catalog/catalogRail";
import { CatalogRailShell } from "@/components/ui/sidebarBleedRail";
import { RAIL_INNER_CLASS } from "@/lib/catalogGrid";
import { cn } from "@/lib/utils";

type CategoryRailSectionSkeletonProps = {
  /** Tailwind width class for the title placeholder (e.g. w-32). */
  titleWidth?: string;
  count?: number;
  className?: string;
};

/** Rail section shell — title + bleed carousel, matches CatalogRail / NewEpisodesRail layout. */
export default function CategoryRailSectionSkeleton({
  titleWidth = "w-36",
  count = 8,
  className,
}: CategoryRailSectionSkeletonProps) {
  return (
    <div className={cn(RAIL_INNER_CLASS, className)} aria-hidden>
      <div
        className={cn(
          "h-[1.125rem] animate-pulse rounded bg-default-200 dark:bg-default-100/10",
          titleWidth
        )}
      />
      <CatalogRailShell bleed>
        <CatalogRailSkeleton count={count} bleed />
      </CatalogRailShell>
    </div>
  );
}
