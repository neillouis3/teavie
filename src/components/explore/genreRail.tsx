"use client";

import React, { useMemo } from "react";
import ExploreSectionTitle from "@/components/explore/exploreSectionTitle";
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
};

const CAROUSEL_ITEM =
  "basis-[42%] pl-3 sm:basis-[30%] md:basis-1/4 lg:basis-1/5 xl:basis-1/6";

export default function GenreRail({ genres }: GenreRailProps) {
  const railGenres = useMemo(() => exploreGenreRailRows(genres), [genres]);

  if (railGenres.length === 0) {
    return null;
  }

  return (
    <section className="flex w-full flex-col gap-3" aria-label="Browse by genre">
      <ExploreSectionTitle>Browse by genre</ExploreSectionTitle>

      <Carousel opts={{ align: "start", dragFree: true }} className="w-full">
        <CarouselContent className="-ml-3">
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
    </section>
  );
}
