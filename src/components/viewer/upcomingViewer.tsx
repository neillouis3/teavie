'use client'

import React from "react";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from "@/components/ui/carousel";
import LargeCard from "../ui/largeCard";
import type { ContentItem } from "@/types/content";

interface UpcomingViewerProps {
  upcomingContentData: ContentItem[];
}

export default function UpcomingViewer({ upcomingContentData }: UpcomingViewerProps) {
  const [api, setApi] = React.useState<CarouselApi>();
  const [current, setCurrent] = React.useState(0);
  const [count, setCount] = React.useState(0);

  React.useEffect(() => {
    if (!api) return;

    setCount(api.scrollSnapList().length);
    setCurrent(api.selectedScrollSnap() + 1);

    api.on("select", () => {
      setCurrent(api.selectedScrollSnap() + 1);
    });
  }, [api]);

  return (
    <div className="w-full flex flex-col items-center">
      <Carousel
        opts={{
          align: "center",
          loop: true,
        }}
        className="w-full"
        setApi={setApi}
      >
        <CarouselContent className="-ml-4">
          {upcomingContentData.map((item) => {
            const title = item.title ?? item.name ?? "Untitled";
            const releaseDate = item.release_date ?? item.first_air_date ?? "";
            const year = releaseDate
              ? String(new Date(releaseDate).getFullYear())
              : "TBA";
            const releaseIso =
              releaseDate && String(releaseDate).length >= 10
                ? String(releaseDate).slice(0, 10)
                : null;

            return (
              <CarouselItem
                key={item.id}
                className="basis-[88%] pl-3 sm:basis-2/3 sm:pl-4"
              >
                <LargeCard
                  id={item.id}
                  title={title}
                  year={year}
                  releaseDate={releaseIso}
                  runtimeSeconds={item.runtimeSeconds}
                  seasonAmount={item.season_amount ?? 0}
                  type={item.type ?? "movie"}
                  posterPath={item.poster_path}
                  backdropPath={item.backdrop_path}
                />
              </CarouselItem>
            );
          })}
        </CarouselContent>
      </Carousel>

      {/* Carousel indicators */}
      <div className="flex justify-center items-center space-x-2 mt-4">
        {Array.from({ length: count }).map((_, index) => (
          <div
            key={index}
            className={`h-2 rounded-full transition-all duration-300 ${
              index === current - 1 ? "w-2 bg-gray-400" : "w-2 bg-gray-500"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
