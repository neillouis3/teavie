"use client";

import React from "react";
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
  GenreCatalogTile,
  genreTileColor,
  type CatalogGenreRow,
} from "@/components/genre/genreTileShared";
import { categoryGenreBrowseHref } from "@/lib/catalogCategories";
import type { CatalogCategory } from "@/lib/catalogCategories";
import {
  RAIL_CAROUSEL_ITEM_GENRE,
  RAIL_INNER_CLASS,
  RAIL_TRACK,
} from "@/lib/catalogGrid";
import { cn } from "@/lib/utils";

type CategoryGenreRailProps = {
  category: CatalogCategory;
  genres: CatalogGenreRow[];
  /** Overlay at the bottom of the category hero spotlight. */
  overlay?: boolean;
};

export default function CategoryGenreRail({
  category,
  genres,
  overlay = false,
}: CategoryGenreRailProps) {
  if (genres.length === 0) return null;

  const rail = (
    <SidebarBleedRail>
      <Carousel opts={SIDEBAR_BLEED_CAROUSEL_OPTS} className="w-full">
        <CarouselContent
          viewportClassName={sidebarBleedViewportClass()}
          className={RAIL_TRACK}
        >
          <SidebarBleedStartSpacer />
          {genres.map((genre, i) => (
            <CarouselItem key={genre.slug} className={RAIL_CAROUSEL_ITEM_GENRE}>
              <GenreCatalogTile
                genre={genre}
                colorClass={genreTileColor(genre.name, i)}
                href={categoryGenreBrowseHref(category, genre.slug)}
              />
            </CarouselItem>
          ))}
        </CarouselContent>
      </Carousel>
    </SidebarBleedRail>
  );

  if (overlay) {
    return (
      <div
        className="pointer-events-none absolute inset-x-0 bottom-4 z-20 lg:bottom-6"
        aria-label="Browse by genre"
      >
        <div className="pointer-events-auto">{rail}</div>
      </div>
    );
  }

  return (
    <section className={cn(RAIL_INNER_CLASS)} aria-label="Browse by genre">
      {rail}
    </section>
  );
}
