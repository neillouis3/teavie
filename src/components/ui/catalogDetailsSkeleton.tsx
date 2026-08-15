"use client";

import React from "react";
import { CatalogMediaPanelSkeleton } from "@/components/ui/catalogMediaPanel";
import { CatalogRailSkeleton } from "@/components/catalog/catalogRail";
import {
  SHOW_DETAILS_HERO_OVERLAP,
  SHOW_DETAILS_MODAL_HERO_HEIGHT,
  SHOW_DETAILS_MODAL_HERO_MB,
} from "@/components/show/ShowDetailsHero";
import { SHOW_CONTENT_INSET_X } from "@/lib/contentInset";
import { DETAIL_CONTENT_STACK_CLASS } from "@/lib/catalogGrid";

/**
 * Shared loading shell for movie + show details pages.
 * Matches the real layout: banner hero, then media panel (no player).
 */
export default function CatalogDetailsSkeleton({
  modal = false,
  bannerUrl = null,
}: {
  /** Taller hero to match the desktop details modal overlay layout. */
  modal?: boolean;
  /** Card-seeded backdrop shown while details load in the modal. */
  bannerUrl?: string | null;
}) {
  return (
    <div
      className={`flex w-full flex-col overflow-x-hidden pb-32 ${
        modal ? "bg-transparent" : "bg-background"
      }`}
    >
      <section
        className={`relative z-0 -mt-14 w-full shrink-0 overflow-hidden rounded-tl-2xl ${
          modal ? `${SHOW_DETAILS_MODAL_HERO_MB} min-h-[26rem]` : "mb-0 min-h-[20rem]"
        } ${
          bannerUrl
            ? "bg-default-200"
            : "animate-pulse bg-default-200/80 dark:bg-default-100/15"
        }`}
        style={{
          height: modal ? SHOW_DETAILS_MODAL_HERO_HEIGHT : "calc(40vh + 3.5rem)",
        }}
        aria-hidden
      >
        {bannerUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={bannerUrl}
            alt=""
            className="absolute inset-0 h-full w-full object-cover object-[center_25%]"
          />
        ) : null}
        <div
          className={`pointer-events-none absolute inset-0 bg-gradient-to-t ${
            modal
              ? "from-background from-0% via-background/80 via-30% to-transparent to-75% dark:from-[#101214] dark:via-[#101214]/85"
              : "from-background from-0% via-background/45 via-40% to-transparent dark:from-[#101214] dark:via-[#101214]/55"
          }`}
          aria-hidden
        />
      </section>
      <div
        className={`relative z-10 ${DETAIL_CONTENT_STACK_CLASS} ${SHOW_CONTENT_INSET_X} ${SHOW_DETAILS_HERO_OVERLAP}`}
      >
        <CatalogMediaPanelSkeleton />
        {modal ? null : (
          <div className="space-y-3 pt-4" aria-hidden>
            <div className="h-5 w-36 animate-pulse rounded bg-default-200 dark:bg-white/10" />
            <CatalogRailSkeleton count={8} bleed />
          </div>
        )}
      </div>
    </div>
  );
}
