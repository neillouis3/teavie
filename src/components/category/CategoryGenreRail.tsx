"use client";

import React from "react";
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
  FLUSH_RAIL_CAROUSEL_ITEM_GENRE,
  FLUSH_RAIL_TRACK,
} from "@/lib/catalogGrid";
import { SIDEBAR_BLEED_CAROUSEL_OPTS } from "@/components/ui/sidebarBleedRail";

type CategoryGenreRailProps = {
  category: CatalogCategory;
  genres: CatalogGenreRow[];
};

/** Full-width genre tiles with no content gutter. */
export default function CategoryGenreRail({
  category,
  genres,
}: CategoryGenreRailProps) {
  if (genres.length === 0) return null;

  return (
    <section className="w-full" aria-label="Browse by genre">
      <Carousel opts={SIDEBAR_BLEED_CAROUSEL_OPTS} className="w-full">
        <CarouselContent viewportClassName="w-full overflow-hidden" className={FLUSH_RAIL_TRACK}>
          {genres.map((genre, i) => (
            <CarouselItem key={genre.slug} className={FLUSH_RAIL_CAROUSEL_ITEM_GENRE}>
              <GenreCatalogTile
                genre={genre}
                colorClass={genreTileColor(genre.name, i)}
                href={categoryGenreBrowseHref(category, genre.slug)}
              />
            </CarouselItem>
          ))}
        </CarouselContent>
      </Carousel>
    </section>
  );
}
