"use client";

import React, { useMemo } from "react";
import SmallCard from "@/components/ui/smallCard";
import ExploreSectionTitle from "@/components/explore/exploreSectionTitle";
import SidebarBleedRail, {
  SIDEBAR_BLEED_CAROUSEL_OPTS,
  SidebarBleedStartSpacer,
  sidebarBleedViewportClass,
} from "@/components/ui/sidebarBleedRail";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
} from "@/components/ui/carousel";
import {
  EXPLORE_RAIL_MAX_ITEMS,
  RAIL_CAROUSEL_ITEM_VERTICAL,
  RAIL_INNER_CLASS,
  RAIL_TRACK,
} from "@/lib/catalogGrid";
import { railContentItems } from "@/lib/dedupeContentItems";
import type { ContentItem } from "@/types/content";

function episodeLabel(item: ContentItem): string {
  const total = item.number_of_episodes;
  if (typeof total === "number" && Number.isFinite(total) && total > 0) {
    return `Episode ${total}`;
  }
  return "New episode";
}

type NewEpisodesRailProps = {
  items: ContentItem[];
  maxItems?: number;
};

/** Portrait cards with title + episode only — ignores horizontal card preference. */
export default function NewEpisodesRail({
  items,
  maxItems = EXPLORE_RAIL_MAX_ITEMS,
}: NewEpisodesRailProps) {
  const visibleItems = useMemo(
    () => railContentItems(items, maxItems),
    [items, maxItems]
  );

  if (visibleItems.length === 0) return null;

  return (
    <section className={RAIL_INNER_CLASS} aria-label="New episodes">
      <ExploreSectionTitle variant="explore">New episodes</ExploreSectionTitle>
      <SidebarBleedRail>
        <Carousel opts={SIDEBAR_BLEED_CAROUSEL_OPTS} className="w-full">
          <CarouselContent
            viewportClassName={sidebarBleedViewportClass()}
            className={RAIL_TRACK}
          >
            <SidebarBleedStartSpacer />
            {visibleItems.map((item) => {
              const title = item.title || item.name || "Untitled";
              return (
                <CarouselItem
                  key={`${item.type ?? "tv"}-${item.id}`}
                  className={RAIL_CAROUSEL_ITEM_VERTICAL}
                >
                  <SmallCard
                    id={item.id}
                    title={title}
                    year={episodeLabel(item)}
                    type={item.type || "tv"}
                    posterPath={item.poster_path || ""}
                    overview={item.overview}
                    releaseDate={item.first_air_date ?? item.release_date}
                    seasonAmount={item.season_amount ?? 0}
                    numberOfEpisodes={item.number_of_episodes ?? undefined}
                  />
                </CarouselItem>
              );
            })}
          </CarouselContent>
        </Carousel>
      </SidebarBleedRail>
    </section>
  );
}
