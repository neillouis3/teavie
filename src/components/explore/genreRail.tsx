"use client";

import React, { useMemo } from "react";
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
  GenreBrowseAllTile,
  genreTileColor,
  type CatalogGenreRow,
} from "@/components/genre/genreTileShared";
import { exploreGenreRailRows } from "@/lib/imdbGenres";
import {
  RAIL_CAROUSEL_ITEM_GENRE,
  RAIL_TRACK,
} from "@/lib/catalogGrid";

type GenreRailProps = {
  genres: CatalogGenreRow[];
  preferredGenreSlugs?: string[];
};

export default function GenreRail({ genres, preferredGenreSlugs = [] }: GenreRailProps) {
  const railGenres = useMemo(
    () => exploreGenreRailRows(genres, preferredGenreSlugs),
    [genres, preferredGenreSlugs]
  );

  if (railGenres.length === 0) {
    return null;
  }

  return (
    <section className="w-full" aria-label="Browse by Genre">
      <SidebarBleedRail>
        <Carousel opts={SIDEBAR_BLEED_CAROUSEL_OPTS} className="w-full">
          <CarouselContent
            viewportClassName={sidebarBleedViewportClass()}
            className={RAIL_TRACK}
          >
            <SidebarBleedStartSpacer />
            {railGenres.map((genre, i) => (
              <CarouselItem key={genre.slug} className={RAIL_CAROUSEL_ITEM_GENRE}>
                <GenreCatalogTile
                  genre={genre}
                  colorClass={genreTileColor(genre.name, i)}
                />
              </CarouselItem>
            ))}
            <CarouselItem className={RAIL_CAROUSEL_ITEM_GENRE}>
              <GenreBrowseAllTile />
            </CarouselItem>
          </CarouselContent>
        </Carousel>
      </SidebarBleedRail>
    </section>
  );
}
