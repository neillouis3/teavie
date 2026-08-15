"use client";

import React from "react";
import PageBlurredBackdrop from "@/components/ui/pageBlurredBackdrop";
import CatalogGridLoading from "@/components/browse/skeleton/catalogGridLoading";
import CatalogFilterBarSkeleton from "@/components/browse/skeleton/catalogFilterBarSkeleton";
import { CONTENT_INSET_X } from "@/lib/contentInset";
import type { PageBrowseBackdrop } from "@/lib/pageBackdrop";

type BrowseCatalogPageSkeletonProps = {
  pageName: string;
  backdrop?: PageBrowseBackdrop;
};

/** Suspense fallback for browse /all pages — mirrors BrowseCatalogPage layout. */
export default function BrowseCatalogPageSkeleton({
  pageName,
  backdrop = "browse",
}: BrowseCatalogPageSkeletonProps) {
  return (
    <div className="relative min-h-screen w-full pb-10">
      <PageBlurredBackdrop variant={backdrop} />
      <div className={`relative z-10 ${CONTENT_INSET_X}`}>
        <div className="flex items-start gap-4 sm:gap-6 lg:gap-8">
          <aside
            className="hidden w-52 shrink-0 space-y-3 pt-1 lg:block xl:w-60"
            aria-hidden
          >
            <div className="h-4 w-16 animate-pulse rounded bg-white/10" />
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-8 w-full animate-pulse rounded-lg bg-white/5" />
            ))}
          </aside>
          <main className="min-w-0 flex-1">
            <div className="mb-5 flex items-end justify-between gap-4">
              <h1 className="sr-only">{pageName}</h1>
              <div className="h-5 w-28 animate-pulse rounded bg-white/10" />
              <div className="h-8 w-24 shrink-0 animate-pulse rounded-full bg-white/10" />
            </div>
            <div className="mb-5 lg:hidden">
              <CatalogFilterBarSkeleton variant="browse" />
            </div>
            <CatalogGridLoading />
          </main>
        </div>
      </div>
    </div>
  );
}
