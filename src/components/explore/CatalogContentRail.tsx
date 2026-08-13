"use client";

import React from "react";
import SmallCard from "@/components/ui/smallCard";
import HorizontalCatalogCard from "@/components/ui/horizontalCatalogCard";
import UserContentRail, { useCatalogRailLayout } from "@/components/explore/UserContentRail";
import {
  catalogItemMediaType,
  catalogItemTitle,
  catalogItemYear,
} from "@/lib/catalogRailCard";
import type { ContentItem } from "@/types/content";

type CatalogContentRailProps = {
  title: string;
  ariaLabel: string;
  items: ContentItem[];
  layout?: "explore" | "profile";
  maxItems?: number;
  className?: string;
  showVoteAverage?: boolean;
  onDismiss?: (item: ContentItem) => void;
  topNoteForItem?: (item: ContentItem) => string | undefined;
  metaChipsForItem?: (item: ContentItem) => string[] | undefined;
};

export default function CatalogContentRail({
  title,
  ariaLabel,
  items,
  layout = "explore",
  maxItems,
  className,
  showVoteAverage = false,
  onDismiss,
  topNoteForItem,
  metaChipsForItem,
}: CatalogContentRailProps) {
  const { horizontal } = useCatalogRailLayout(layout);

  return (
    <UserContentRail
      title={title}
      ariaLabel={ariaLabel}
      items={items}
      layout={layout}
      maxItems={maxItems}
      className={className}
      getItemKey={(item) =>
        `${catalogItemMediaType(item)}-${item.id}`
      }
      renderItem={(item) => {
        const titleText = catalogItemTitle(item);
        const year = catalogItemYear(item);
        const mediaType = catalogItemMediaType(item);
        const topNote = topNoteForItem?.(item);
        const metaChips = metaChipsForItem?.(item);
        const dismiss = onDismiss ? () => onDismiss(item) : undefined;

        return horizontal ? (
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
        ) : (
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
      }}
    />
  );
}
