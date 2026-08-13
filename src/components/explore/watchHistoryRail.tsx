"use client";

import React from "react";
import UserContentRail, { useCatalogRailLayout } from "@/components/explore/UserContentRail";
import SmallCard from "@/components/ui/smallCard";
import HorizontalCatalogCard from "@/components/ui/horizontalCatalogCard";
import { watchHistoryMetaChips } from "@/lib/watchHistory";
import {
  catalogItemMediaType,
  catalogItemTitle,
  catalogItemYear,
} from "@/lib/catalogRailCard";
import type { ExploreHistoryRow } from "@/lib/explorePageData";
import { useUserData } from "@/contexts/userDataContext";

type WatchHistoryRailProps = {
  items: ExploreHistoryRow[];
  layout?: "explore" | "profile";
  bleed?: boolean;
  display?: "rail" | "grid";
  maxItems?: number;
  className?: string;
};

export default function WatchHistoryRail({
  items,
  layout = "explore",
  bleed = true,
  display = "rail",
  maxItems,
  className,
}: WatchHistoryRailProps) {
  const { watchHistoryEntries, removeHistoryItem } = useUserData();
  const { horizontal } = useCatalogRailLayout(layout);

  const progressById = React.useMemo(
    () => new Map(watchHistoryEntries.map((e) => [e.catalogId, e] as const)),
    [watchHistoryEntries]
  );

  const visibleItems = React.useMemo(
    () => items.filter((item) => progressById.has(String(item.id))),
    [items, progressById]
  );

  return (
    <UserContentRail
      title="Continue watching"
      ariaLabel="Watch history"
      items={visibleItems}
      layout={layout}
      bleed={bleed}
      display={display}
      maxItems={maxItems}
      className={className}
      getItemKey={(item) => `${catalogItemMediaType(item)}-${item.id}`}
      renderItem={(item) => {
        const progress = progressById.get(String(item.id));
        if (!progress) return null;

        const titleText = catalogItemTitle(item);
        const year = catalogItemYear(item);
        const mediaType = catalogItemMediaType(item);
        const metaChips = watchHistoryMetaChips(
          {
            mediaType: progress.mediaType,
            lastSeason: progress.lastSeason,
            lastEpisode: progress.lastEpisode,
          },
          item.season_amount ?? 0,
          item.runtimeSeconds ?? undefined
        );
        const dismiss = () => void removeHistoryItem(String(item.id));

        return horizontal ? (
          <HorizontalCatalogCard
            id={item.id}
            title={titleText}
            year={year}
            type={mediaType}
            posterPath={item.poster_path || ""}
            backdropPath={item.backdrop_path || ""}
            topNote={metaChips?.join(" · ")}
            onDismiss={dismiss}
          />
        ) : (
          <SmallCard
            id={item.id}
            title={titleText}
            year={year}
            type={mediaType}
            runtimeSeconds={item.runtimeSeconds ?? undefined}
            seasonAmount={item.season_amount ?? 0}
            numberOfEpisodes={item.number_of_episodes ?? undefined}
            posterPath={item.poster_path || ""}
            metaChips={metaChips}
            onDismiss={dismiss}
          />
        );
      }}
    />
  );
}
