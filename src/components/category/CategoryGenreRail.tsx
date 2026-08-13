"use client";

import React from "react";
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

type CategoryGenreRailProps = {
  category: CatalogCategory;
  genres: CatalogGenreRow[];
  /** Hide section title when used as the page hero. */
  showTitle?: boolean;
};

export default function CategoryGenreRail({
  category,
  genres,
  showTitle = true,
}: CategoryGenreRailProps) {
  if (genres.length === 0) return null;

  return (
    <section className={RAIL_INNER_CLASS} aria-label="Browse by genre">
      {showTitle ? (
        <ExploreSectionTitle variant="explore">Browse by genre</ExploreSectionTitle>
      ) : null}
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
    </section>
  );
}
