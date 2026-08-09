"use client";

import React, { useMemo } from "react";
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
import {
  EXPLORE_RAIL_MAX_ITEMS,
  RAIL_CAROUSEL_ITEM_HORIZONTAL,
  RAIL_CAROUSEL_ITEM_VERTICAL,
  RAIL_CAROUSEL_ITEM_VERTICAL_PROFILE,
  RAIL_INNER_CLASS,
  RAIL_TRACK,
} from "@/lib/catalogGrid";
import { railContentItems } from "@/lib/dedupeContentItems";
import type { ContentItem } from "@/types/content";

type FavoritesRailProps = {
  items: ContentItem[];
  layout?: "explore" | "profile";
  maxItems?: number;
  className?: string;
};

export default function FavoritesRail({
  items,
  layout = "explore",
  maxItems = EXPLORE_RAIL_MAX_ITEMS,
  className = "",
}: FavoritesRailProps) {
  const { mode } = useCatalogCardStyle();
  const horizontal = mode === "horizontal";
  const profile = layout === "profile";
  const itemClass = horizontal
    ? RAIL_CAROUSEL_ITEM_HORIZONTAL
    : profile
      ? RAIL_CAROUSEL_ITEM_VERTICAL_PROFILE
      : RAIL_CAROUSEL_ITEM_VERTICAL;

  const visibleItems = useMemo(
    () => railContentItems(items, maxItems),
    [items, maxItems]
  );

  if (visibleItems.length === 0) return null;

  return (
    <section
      className={`${RAIL_INNER_CLASS} ${className}`}
      aria-label="Favorites"
    >
      <ExploreSectionTitle variant="explore">Favorites</ExploreSectionTitle>

      <SidebarBleedRail>
        <Carousel opts={SIDEBAR_BLEED_CAROUSEL_OPTS} className="w-full">
          <CarouselContent
            viewportClassName={sidebarBleedViewportClass()}
            className={RAIL_TRACK}
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
                    />
                  ) : (
                    <SmallCard
                      id={item.id}
                      title={titleText}
                      year={year}
                      voteAverage={item.vote_average}
                      type={mediaType}
                      runtimeSeconds={item.runtimeSeconds ?? undefined}
                      seasonAmount={item.season_amount ?? 0}
                      numberOfEpisodes={item.number_of_episodes ?? undefined}
                      posterPath={item.poster_path || ""}
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
