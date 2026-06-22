"use client";

import React, { useEffect, useState } from "react";
import { Chip } from "@heroui/react";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
} from "@/components/ui/carousel";
import {
  GenreCatalogTile,
  GenreTilesSkeleton,
  genreTileColor,
  type CatalogGenreRow,
} from "@/components/genre/genreTileShared";

export default function GenreDiscover() {
  const [genres, setGenres] = useState<CatalogGenreRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch("/api/genres/popular")
      .then((res) => res.json())
      .then((json) => {
        if (cancelled) return;
        setGenres(json.genres ?? []);
      })
      .catch(() => {
        if (!cancelled) setGenres([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!loading && genres.length === 0) {
    return null;
  }

  return (
    <section className="flex w-full flex-col gap-3" aria-label="Browse by genre">
      <Chip color="success" variant="flat" size="md" radius="sm">
        Browse by genre
      </Chip>

      {loading ? (
        <GenreTilesSkeleton count={8} />
      ) : (
        <Carousel opts={{ align: "start", dragFree: true }} className="w-full">
          <CarouselContent className="-ml-3">
            {genres.map((genre, i) => (
              <CarouselItem
                key={genre.slug}
                className="basis-[42%] pl-3 sm:basis-[30%] md:basis-1/4 lg:basis-1/5 xl:basis-1/6"
              >
                <GenreCatalogTile
                  genre={genre}
                  colorClass={genreTileColor(genre.name, i)}
                />
              </CarouselItem>
            ))}
          </CarouselContent>
        </Carousel>
      )}
    </section>
  );
}
