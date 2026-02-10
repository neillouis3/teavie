'use client'

import React from "react";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from "@/components/ui/carousel";
import LargeCard from "../ui/largeCard";

// Type for upcoming items
type ContentItem = {
  id: number;
  title?: string;          // movies
  name?: string;           // TV shows
  release_date?: string;   // movies
  first_air_date?: string; // TV shows
  poster_path?: string;
  backdrop_path?: string;
  overview?: string;
  type?: "movie" | "tv";   // optional type flag
  runtimeSeconds?: number;
};

// Props
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

            return (
              <CarouselItem key={item.id} className="pl-4 basis-2/3">
                <LargeCard
                  id={item.id}
                  title={title}
                  year={year}
                  runtimeSeconds={item.runtimeSeconds}
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
