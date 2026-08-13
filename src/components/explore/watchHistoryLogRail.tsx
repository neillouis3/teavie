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
import type { ExploreHistoryRow } from "@/lib/continueWatchingRows";
import { useUserData } from "@/contexts/userDataContext";

type WatchHistoryLogRailProps = {
  items: ExploreHistoryRow[];
  layout?: "explore" | "profile";
  bleed?: boolean;
  display?: "rail" | "grid";
  maxItems?: number;
  className?: string;
};

export default function WatchHistoryLogRail({
  items,
  layout = "profile",
  bleed = true,
  display = "rail",
  maxItems,
  className,
}: WatchHistoryLogRailProps) {
  const { removeHistoryLogItem } = useUserData();
  const { horizontal } = useCatalogRailLayout(layout);

  return (
    <UserContentRail
      title="Watch history"
      ariaLabel="Watch history"
      items={items}
      layout={layout}
      bleed={bleed}
      display={display}
      maxItems={maxItems}
      className={className}
      getItemKey={(item) => `history-${catalogItemMediaType(item)}-${item.id}`}
      renderItem={(item) => {
        const mediaType = catalogItemMediaType(item);
        const titleText = catalogItemTitle(item);
        const year = catalogItemYear(item);
        const metaChips = watchHistoryMetaChips(
          {
            mediaType,
            lastSeason: item.lastSeason,
            lastEpisode: item.lastEpisode,
          },
          item.season_amount ?? 0,
          item.runtimeSeconds ?? undefined
        );
        const dismiss = () => void removeHistoryLogItem(String(item.id));

        return horizontal ? (
          <HorizontalCatalogCard
            id={item.id}
            title={titleText}
            year={year}
            type={mediaType}
            posterPath={item.poster_path || ""}
            backdropPath={item.backdrop_path || ""}
            topNote={
              mediaType === "movie" ? "Watched" : metaChips?.join(" · ")
            }
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
            metaChips={mediaType === "movie" ? ["Watched"] : metaChips}
            onDismiss={dismiss}
          />
        );
      }}
    />
  );
}
