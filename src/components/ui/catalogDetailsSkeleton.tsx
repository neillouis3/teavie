"use client";

import React from "react";
import { CatalogMediaPanelSkeleton } from "@/components/ui/catalogMediaPanel";
import { SHOW_DETAILS_HERO_OVERLAP } from "@/components/show/ShowDetailsHero";
import { SHOW_CONTENT_INSET_X } from "@/lib/contentInset";

/**
 * Shared loading shell for movie + show details pages.
 * Matches the real layout: banner hero, then media panel (no player).
 */
export default function CatalogDetailsSkeleton() {
  return (
    <div className="flex w-full flex-col overflow-x-hidden bg-background pb-32">
      <section
        className="relative z-0 -mt-14 mb-0 w-full shrink-0 overflow-hidden rounded-tl-2xl min-h-[20rem] animate-pulse bg-default-200/80 dark:bg-default-100/15"
        style={{ height: "calc(40vh + 3.5rem)" }}
        aria-hidden
      >
        <div
          className="pointer-events-none absolute inset-0 bg-gradient-to-t from-background from-0% via-background/45 via-40% to-transparent"
          aria-hidden
        />
      </section>
      <div
        className={`relative z-10 flex w-full flex-col gap-6 ${SHOW_CONTENT_INSET_X} ${SHOW_DETAILS_HERO_OVERLAP}`}
      >
        <CatalogMediaPanelSkeleton />
        <div className="space-y-3 pt-4" aria-hidden>
          <div className="h-5 w-36 animate-pulse rounded bg-default-200" />
          <div className="flex gap-3 overflow-hidden">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="h-52 w-36 shrink-0 animate-pulse rounded-lg bg-default-200"
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
