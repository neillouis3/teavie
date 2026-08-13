"use client";

import React from "react";
import { cn } from "@/lib/utils";
import SmallCard from "@/components/ui/smallCard";
import HorizontalCatalogCard from "@/components/ui/horizontalCatalogCard";
import ExploreSectionTitle from "@/components/explore/exploreSectionTitle";
import UserContentRail, { useCatalogRailLayout } from "@/components/explore/UserContentRail";
import {
  catalogItemMediaType,
  catalogItemTitle,
  catalogItemYear,
} from "@/lib/catalogRailCard";
import { EXPLORE_RAIL_MAX_ITEMS, LIBRARY_GRID_CLASS, RAIL_INNER_CLASS } from "@/lib/catalogGrid";
import { railContentItems } from "@/lib/dedupeContentItems";
import type { ContentItem } from "@/types/content";

type CatalogContentRailProps = {
  title: string;
  ariaLabel: string;
  items: ContentItem[];
  layout?: "explore" | "profile";
  bleed?: boolean;
  /** Carousel rail (default) or centered grid (Library). */
  display?: "rail" | "grid";
  maxItems?: number;
  className?: string;
  sectionTitleClassName?: string;
  showVoteAverage?: boolean;
  onDismiss?: (item: ContentItem) => void;
  topNoteForItem?: (item: ContentItem) => string | undefined;
  metaChipsForItem?: (item: ContentItem) => string[] | undefined;
};

function renderCatalogCard(
  item: ContentItem,
  horizontal: boolean,
  {
    showVoteAverage,
    onDismiss,
    topNoteForItem,
    metaChipsForItem,
  }: Pick<
    CatalogContentRailProps,
    "showVoteAverage" | "onDismiss" | "topNoteForItem" | "metaChipsForItem"
  >
) {
  const titleText = catalogItemTitle(item);
  const year = catalogItemYear(item);
  const mediaType = catalogItemMediaType(item);
  const topNote = topNoteForItem?.(item);
  const metaChips = metaChipsForItem?.(item);
  const dismiss = onDismiss ? () => onDismiss(item) : undefined;

  if (horizontal) {
    return (
      <HorizontalCatalogCard
        id={item.id}
        title={titleText}
        year={year}
        type={mediaType}
        posterPath={item.poster_path || ""}
        backdropPath={item.backdrop_path || ""}
        overview={item.overview}
        releaseDate={item.release_date ?? item.first_air_date ?? undefined}
        topNote={topNote}
        onDismiss={dismiss}
      />
    );
  }

  return (
    <SmallCard
      id={item.id}
      title={titleText}
      year={year}
      voteAverage={showVoteAverage ? item.vote_average : undefined}
      type={mediaType}
      runtimeSeconds={item.runtimeSeconds ?? undefined}
      seasonAmount={item.season_amount ?? 0}
      numberOfEpisodes={item.number_of_episodes ?? undefined}
      posterPath={item.poster_path || ""}
      overview={item.overview}
      releaseDate={item.release_date ?? item.first_air_date ?? undefined}
      metaChips={metaChips}
      onDismiss={dismiss}
    />
  );
}

export default function CatalogContentRail({
  title,
  ariaLabel,
  items,
  layout = "explore",
  bleed = true,
  display = "rail",
  maxItems,
  className,
  sectionTitleClassName,
  showVoteAverage = false,
  onDismiss,
  topNoteForItem,
  metaChipsForItem,
}: CatalogContentRailProps) {
  const { horizontal } = useCatalogRailLayout(layout);
  const cardOpts = { showVoteAverage, onDismiss, topNoteForItem, metaChipsForItem };

  if (display === "grid") {
    const slice = railContentItems(items ?? [], maxItems ?? EXPLORE_RAIL_MAX_ITEMS);
    if (slice.length === 0) return null;

    return (
      <section
        className={cn(RAIL_INNER_CLASS, "items-center", className)}
        aria-label={ariaLabel}
      >
        <ExploreSectionTitle
          variant="explore"
          className={cn("justify-center text-white", sectionTitleClassName)}
        >
          {title}
        </ExploreSectionTitle>
        <div className={LIBRARY_GRID_CLASS}>
          {slice.map((item) => (
            <div key={`${catalogItemMediaType(item)}-${item.id}`}>
              {renderCatalogCard(item, false, cardOpts)}
            </div>
          ))}
        </div>
      </section>
    );
  }

  return (
    <UserContentRail
      title={title}
      ariaLabel={ariaLabel}
      items={items}
      layout={layout}
      bleed={bleed}
      maxItems={maxItems}
      className={className}
      getItemKey={(item) => `${catalogItemMediaType(item)}-${item.id}`}
      renderItem={(item) => renderCatalogCard(item, horizontal, cardOpts)}
    />
  );
}
