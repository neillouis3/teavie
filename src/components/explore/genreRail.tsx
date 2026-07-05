"use client";

import React, { useMemo } from "react";
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
  GenreBrowseAllTile,
  genreTileColor,
  type CatalogGenreRow,
} from "@/components/genre/genreTileShared";
import { exploreGenreRailRows } from "@/lib/imdbGenres";

type GenreRailProps = {
  genres: CatalogGenreRow[];
  preferredGenreSlugs?: string[];
};

const CAROUSEL_ITEM =
  "basis-[42%] pl-3 sm:basis-[30%] md:basis-1/4 lg:basis-[calc(100%/7.3333333333)]";

export default function GenreRail({ genres, preferredGenreSlugs = [] }: GenreRailProps) {
  const railGenres = useMemo(
    () => exploreGenreRailRows(genres, preferredGenreSlugs),
    [genres, preferredGenreSlugs]
  );

  if (railGenres.length === 0) {
    return null;
  }

  return (
    <section className="mt-16 flex w-full flex-col gap-3" aria-label="Browse by genre">
      <ExploreSectionTitle variant="explore">Browse by genre</ExploreSectionTitle>

      <SidebarBleedRail>
        <Carousel opts={SIDEBAR_BLEED_CAROUSEL_OPTS} className="w-full">
          <CarouselContent
            viewportClassName={sidebarBleedViewportClass()}
            className="-ml-3"
          >
            <SidebarBleedStartSpacer />
            {railGenres.map((genre, i) => (
              <CarouselItem key={genre.slug} className={CAROUSEL_ITEM}>
                <GenreCatalogTile
                  genre={genre}
                  colorClass={genreTileColor(genre.name, i)}
                />
              </CarouselItem>
            ))}
            <CarouselItem className={CAROUSEL_ITEM}>
              <GenreBrowseAllTile />
            </CarouselItem>
          </CarouselContent>
        </Carousel>
      </SidebarBleedRail>
    </section>
  );
}
