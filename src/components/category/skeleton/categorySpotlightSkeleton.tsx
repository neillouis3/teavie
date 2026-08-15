"use client";

import React from "react";
import { SPOTLIGHT_SKELETON_H } from "@/components/catalog/trendingHero";
import { RAIL_AFTER_SPOTLIGHT } from "@/lib/catalogGrid";
import { cn } from "@/lib/utils";

/** Spotlight hero shell for anime / K-Drama hub pages — matches loaded hero + browse bar overlay. */
export default function CategorySpotlightSkeleton() {
  return (
    <section
      className={cn(
        "relative z-0 -mt-14 w-full overflow-hidden rounded-tl-2xl",
        RAIL_AFTER_SPOTLIGHT
      )}
      aria-hidden
    >
      <div
        className={cn(
          "animate-pulse bg-default-200 dark:bg-default-100/10",
          SPOTLIGHT_SKELETON_H
        )}
      />
      <nav
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-4 z-20 flex translate-y-6 justify-start px-4 lg:bottom-6 lg:translate-y-0 lg:px-24"
      >
        <div className="h-11 w-40 animate-pulse rounded-full bg-black/25 dark:bg-white/10" />
      </nav>
    </section>
  );
}
