"use client";

import React from "react";
import { Chip } from "@heroui/react";
import SmallCard from "@/components/ui/smallCard";
import HorizontalCatalogCard from "@/components/ui/horizontalCatalogCard";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
} from "@/components/ui/carousel";
import { useCatalogCardStyle } from "@/contexts/catalogCardStyleContext";
import type { ExploreHistoryRow } from "@/lib/explorePageData";

const CAROUSEL_ITEM_VERTICAL =
  "basis-[45%] pl-3 sm:basis-[32%] md:basis-1/5 lg:basis-[14%] xl:basis-[12%]";
const CAROUSEL_ITEM_HORIZONTAL =
  "basis-[88%] pl-3 sm:basis-[55%] md:basis-[42%] lg:basis-1/3 xl:basis-1/4";

type WatchHistoryRailProps = {
  items: ExploreHistoryRow[];
};

export default function WatchHistoryRail({ items }: WatchHistoryRailProps) {
  const { mode } = useCatalogCardStyle();
  const horizontal = mode === "horizontal";
  const itemClass = horizontal ? CAROUSEL_ITEM_HORIZONTAL : CAROUSEL_ITEM_VERTICAL;

  if (items.length === 0) {
    return null;
  }

  return (
    <section className="mb-8 flex w-full flex-col gap-3" aria-label="Watch history">
      <Chip color="success" variant="flat" size="md" radius="sm">
        Continue watching
      </Chip>

      <Carousel opts={{ align: "start", dragFree: true }} className="w-full">
        <CarouselContent className="-ml-3">
          {items.map((item) => {
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
                    releaseNote={item.progressLabel}
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
    </section>
  );
}
