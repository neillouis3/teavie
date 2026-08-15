"use client";

import React from "react";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
} from "@/components/ui/carousel";
import SidebarBleedRail, {
  SIDEBAR_BLEED_CAROUSEL_OPTS,
  SidebarBleedStartSpacer,
  sidebarBleedViewportClass,
} from "@/components/ui/sidebarBleedRail";
import { RAIL_CAROUSEL_ITEM_GENRE, RAIL_TRACK } from "@/lib/catalogGrid";

/** Genre carousel shell — matches CategoryGenreRail tile aspect and bleed track. */
export default function CategoryGenreRailSkeleton({ count = 6 }: { count?: number }) {
  return (
    <section className="w-full" aria-hidden>
      <SidebarBleedRail>
        <Carousel opts={SIDEBAR_BLEED_CAROUSEL_OPTS} className="w-full">
          <CarouselContent
            viewportClassName={sidebarBleedViewportClass()}
            className={RAIL_TRACK}
          >
            <SidebarBleedStartSpacer />
            {Array.from({ length: count }).map((_, index) => (
              <CarouselItem key={index} className={RAIL_CAROUSEL_ITEM_GENRE}>
                <div className="aspect-[40/21] w-full animate-pulse rounded-xl bg-default-200 dark:bg-default-100/10" />
              </CarouselItem>
            ))}
          </CarouselContent>
        </Carousel>
      </SidebarBleedRail>
    </section>
  );
}
