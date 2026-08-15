"use client";

import React, { useMemo } from "react";
import { cn } from "@/lib/utils";
import ExploreSectionTitle from "@/components/explore/exploreSectionTitle";
import SidebarBleedRail, {
  SIDEBAR_BLEED_CAROUSEL_OPTS,
  SidebarBleedStartSpacer,
  catalogRailViewportClass,
  sidebarBleedViewportClass,
} from "@/components/ui/sidebarBleedRail";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
} from "@/components/ui/carousel";
import { useCatalogCardStyle } from "@/contexts/catalogCardStyleContext";
import {
  EXPLORE_RAIL_MAX_ITEMS,
  LIBRARY_GRID_CLASS,
  RAIL_CAROUSEL_ITEM_HORIZONTAL,
  RAIL_CAROUSEL_ITEM_VERTICAL,
  RAIL_CAROUSEL_ITEM_VERTICAL_PROFILE,
  RAIL_INNER_CLASS,
  RAIL_TRACK,
} from "@/lib/catalogGrid";
import { railContentItems } from "@/lib/dedupeContentItems";
import type { ContentItem } from "@/types/content";

type UserContentRailProps<T extends ContentItem> = {
  title: string;
  ariaLabel: string;
  items: T[];
  layout?: "explore" | "profile";
  /** Extend rail under the sidebar (Explore). Off for Library-style pages. */
  bleed?: boolean;
  /** Carousel rail (default) or centered grid (Library / Activity). */
  display?: "rail" | "grid";
  maxItems?: number;
  className?: string;
  sectionTitleClassName?: string;
  getItemKey: (item: T) => string;
  renderItem: (item: T) => React.ReactNode;
};

export default function UserContentRail<T extends ContentItem>({
  title,
  ariaLabel,
  items,
  layout = "explore",
  bleed = true,
  display = "rail",
  maxItems = EXPLORE_RAIL_MAX_ITEMS,
  className = "",
  sectionTitleClassName,
  getItemKey,
  renderItem,
}: UserContentRailProps<T>) {
  const { mode } = useCatalogCardStyle();
  const horizontal = mode === "horizontal";
  const profile = layout === "profile";
  const itemClass = horizontal
    ? RAIL_CAROUSEL_ITEM_HORIZONTAL
    : profile
      ? RAIL_CAROUSEL_ITEM_VERTICAL_PROFILE
      : RAIL_CAROUSEL_ITEM_VERTICAL;

  const visibleItems = useMemo(
    () => railContentItems(items, maxItems) as T[],
    [items, maxItems]
  );

  if (visibleItems.length === 0) return null;

  if (display === "grid") {
    return (
      <section
        className={cn(RAIL_INNER_CLASS, "items-center", className)}
        aria-label={ariaLabel}
      >
        <ExploreSectionTitle
          variant="explore"
          className={cn("justify-center", sectionTitleClassName)}
        >
          {title}
        </ExploreSectionTitle>
        <div className={LIBRARY_GRID_CLASS}>
          {visibleItems.map((item) => (
            <div key={getItemKey(item)}>{renderItem(item)}</div>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className={`${RAIL_INNER_CLASS} ${className}`} aria-label={ariaLabel}>
      <ExploreSectionTitle
        variant="explore"
        className={sectionTitleClassName}
      >
        {title}
      </ExploreSectionTitle>
      <SidebarBleedRail>
        <Carousel opts={SIDEBAR_BLEED_CAROUSEL_OPTS} className="w-full">
          <CarouselContent
            viewportClassName={
              bleed
                ? sidebarBleedViewportClass()
                : catalogRailViewportClass(false)
            }
            className={RAIL_TRACK}
          >
            {bleed ? <SidebarBleedStartSpacer /> : null}
            {visibleItems.map((item) => (
              <CarouselItem key={getItemKey(item)} className={itemClass}>
                {renderItem(item)}
              </CarouselItem>
            ))}
          </CarouselContent>
        </Carousel>
      </SidebarBleedRail>
    </section>
  );
}

export function useCatalogRailLayout(layout: "explore" | "profile" = "explore") {
  const { mode } = useCatalogCardStyle();
  const horizontal = mode === "horizontal";
  const profile = layout === "profile";
  const itemClass = horizontal
    ? RAIL_CAROUSEL_ITEM_HORIZONTAL
    : profile
      ? RAIL_CAROUSEL_ITEM_VERTICAL_PROFILE
      : RAIL_CAROUSEL_ITEM_VERTICAL;
  return { horizontal, itemClass };
}
