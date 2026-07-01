"use client";

import React from "react";
import ExploreSectionTitle from "@/components/explore/exploreSectionTitle";
import SidebarBleedRail, {
  SIDEBAR_BLEED_CAROUSEL_OPTS,
  SidebarBleedStartSpacer,
  sidebarBleedViewportClass,
} from "@/components/ui/sidebarBleedRail";
import SmallCard from "@/components/ui/smallCard";
import HorizontalCatalogCard from "@/components/ui/horizontalCatalogCard";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
} from "@/components/ui/carousel";
import { useCatalogCardStyle } from "@/contexts/catalogCardStyleContext";
import { watchHistoryMetaChips } from "@/lib/watchHistory";
import type { ExploreHistoryRow } from "@/lib/explorePageData";
import { useUserData } from "@/contexts/userDataContext";

const CAROUSEL_ITEM_VERTICAL =
  "basis-[45%] pl-3 sm:basis-[32%] md:basis-1/5 lg:basis-[14%] xl:basis-[12%]";
const CAROUSEL_ITEM_VERTICAL_PROFILE =
  "basis-[45%] pl-3 sm:basis-[30%] md:basis-1/4 lg:basis-[calc(100%/7)] xl:basis-[calc(100%/7)]";
const CAROUSEL_ITEM_HORIZONTAL =
  "basis-[88%] pl-3 sm:basis-[55%] md:basis-[42%] lg:basis-1/3 xl:basis-1/4";

type WatchHistoryRailProps = {
  items: ExploreHistoryRow[];
  layout?: "explore" | "profile";
  maxItems?: number;
  className?: string;
};

export default function WatchHistoryRail({
  items,
  layout = "explore",
  maxItems,
  className = "",
}: WatchHistoryRailProps) {
  const { mode } = useCatalogCardStyle();
  const { watchHistoryEntries, removeHistoryItem } = useUserData();
  const horizontal = mode === "horizontal";
  const profile = layout === "profile";
  const itemClass = horizontal
    ? CAROUSEL_ITEM_HORIZONTAL
    : profile
      ? CAROUSEL_ITEM_VERTICAL_PROFILE
      : CAROUSEL_ITEM_VERTICAL;

  const visibleItems = React.useMemo(() => {
    return maxItems != null ? items.slice(0, maxItems) : items;
  }, [items, maxItems]);

  const progressById = React.useMemo(() => {
    return new Map(watchHistoryEntries.map((e) => [e.catalogId, e] as const));
  }, [watchHistoryEntries, visibleItems]);

  if (visibleItems.length === 0) {
    return null;
  }

  return (
    <section
      className={`flex w-full flex-col gap-3 ${
        profile ? "mt-0 mb-8" : "mt-12 mb-8"
      } ${className}`}
      aria-label="Watch history"
    >
      <ExploreSectionTitle variant="explore">Continue watching</ExploreSectionTitle>

      <SidebarBleedRail>
        <Carousel opts={SIDEBAR_BLEED_CAROUSEL_OPTS} className="w-full">
          <CarouselContent
            viewportClassName={sidebarBleedViewportClass()}
            className="-ml-3"
          >
            <SidebarBleedStartSpacer />
            {visibleItems.map((item) => {
              const titleText = item.title || item.name || "Untitled";
              const year =
                item.release_date?.split("-")[0] ||
                item.first_air_date?.split("-")[0] ||
                "—";
              const mediaType = item.type === "movie" ? "movie" : "tv";
              const key = `${mediaType}-${item.id}`;
              const dismiss = () => void removeHistoryItem(String(item.id));
              const progress = progressById.get(String(item.id));
              if (!progress) return null;
              const historyEntry = {
                mediaType: progress.mediaType,
                lastSeason: progress.lastSeason,
                lastEpisode: progress.lastEpisode,
              };
              const continueMetaChips = watchHistoryMetaChips(
                historyEntry,
                item.season_amount ?? 0,
                item.runtimeSeconds ?? undefined
              );

              return (
                <CarouselItem key={key} className={itemClass}>
                  {horizontal ? (
                    <HorizontalCatalogCard
                      id={item.id}
                      title={titleText}
                      year={year}
                      type={mediaType}
                      posterPath={item.poster_path || ""}
                      backdropPath={item.backdrop_path || ""}
                      topNote={continueMetaChips?.join(" · ")}
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
                      metaChips={continueMetaChips}
                      onDismiss={dismiss}
                    />
                  )}
                </CarouselItem>
              );
            })}
          </CarouselContent>
        </Carousel>
      </SidebarBleedRail>
    </section>
  );
}
