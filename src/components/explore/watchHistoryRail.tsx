"use client";

import React from "react";
import UserContentRail from "@/components/explore/UserContentRail";
import ContinueWatchingCard from "@/components/ui/continueWatchingCard";
import { RAIL_CAROUSEL_ITEM_CONTINUE_WATCHING } from "@/lib/catalogGrid";
import { watchHistoryCardLines } from "@/lib/watchHistory";
import { buildShowWatchHref } from "@/lib/showCatalogHelpers";
import {
  catalogItemMediaType,
  catalogItemTitle,
  catalogItemYear,
} from "@/lib/catalogRailCard";
import type { ExploreHistoryRow } from "@/lib/continueWatchingRows";
import { useUserData } from "@/contexts/userDataContext";

type WatchHistoryRailProps = {
  items: ExploreHistoryRow[];
  layout?: "explore" | "profile";
  bleed?: boolean;
  display?: "rail" | "grid";
  maxItems?: number;
  className?: string;
};

function continueWatchingHref(item: ExploreHistoryRow, mediaType: "movie" | "tv") {
  if (mediaType === "tv") {
    return buildShowWatchHref(String(item.id), {
      season: item.lastSeason,
      episode: item.lastEpisode,
    });
  }
  return `/movies/${encodeURIComponent(String(item.id))}/watch`;
}

export default function WatchHistoryRail({
  items,
  layout = "explore",
  bleed = true,
  display = "rail",
  maxItems,
  className,
}: WatchHistoryRailProps) {
  const { removeHistoryItem } = useUserData();

  return (
    <UserContentRail
      title="Continue watching"
      ariaLabel="Watch history"
      items={items}
      layout={layout}
      bleed={bleed}
      display={display}
      forceHorizontal
      itemClass={RAIL_CAROUSEL_ITEM_CONTINUE_WATCHING}
      maxItems={maxItems}
      className={className}
      getItemKey={(item) => `${catalogItemMediaType(item)}-${item.id}`}
      renderItem={(item) => {
        const mediaType = catalogItemMediaType(item);
        const titleText = catalogItemTitle(item);
        const year = catalogItemYear(item);
        const { titleLine, subtitleLine } = watchHistoryCardLines(
          titleText,
          {
            mediaType,
            lastSeason: item.lastSeason,
            lastEpisode: item.lastEpisode,
          },
          item.season_amount ?? 0,
          {
            episodeName: item.episodeName,
            runtimeSeconds: item.runtimeSeconds ?? undefined,
          }
        );

        return (
          <ContinueWatchingCard
            id={item.id}
            title={titleLine}
            year={year}
            type={mediaType}
            posterPath={item.poster_path || ""}
            backdropPath={item.backdrop_path || ""}
            episodeStillPath={item.episodeStillPath}
            subtitle={subtitleLine}
            href={continueWatchingHref(item, mediaType)}
            overview={item.overview}
            releaseDate={item.release_date ?? item.first_air_date ?? undefined}
            onDismiss={() => void removeHistoryItem(String(item.id))}
          />
        );
      }}
    />
  );
}
