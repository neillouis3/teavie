"use client";

import React from "react";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  type CarouselApi,
} from "@/components/ui/carousel";
import LargeCard from "@/components/ui/largeCard";
import type { ContentItem } from "@/types/content";

const TRENDING_CAROUSEL_H = "h-[calc(80vh-2rem)]";

const TRENDING_ARROW_CLASS =
  "top-1/2 z-20 h-10 w-10 -translate-y-1/2 border-none bg-black/45 text-white backdrop-blur-sm hover:bg-black/60 disabled:opacity-40";

function interleaveTrending(
  movies: ContentItem[],
  tv: ContentItem[],
  maxItems = 24
): ContentItem[] {
  const out: ContentItem[] = [];
  const n = Math.max(movies.length, tv.length);
  for (let i = 0; i < n && out.length < maxItems; i++) {
    if (i < movies.length && out.length < maxItems) {
      out.push({ ...movies[i], type: movies[i].type ?? "movie" });
    }
    if (i < tv.length && out.length < maxItems) {
      out.push({ ...tv[i], type: tv[i].type ?? "tv" });
    }
  }
  return out;
}

interface TrendingHeroViewerProps {
  trendingMovies: ContentItem[];
  trendingTv: ContentItem[];
  maxItems?: number;
  /** Rounded carousel viewport (category hubs). */
  rounded?: boolean;
  /** Pagination dots under the carousel. @default true */
  showDots?: boolean;
}

export default function TrendingHeroViewer({
  trendingMovies,
  trendingTv,
  maxItems = 24,
  rounded = false,
  showDots = true,
}: TrendingHeroViewerProps) {
  const items = React.useMemo(
    () => interleaveTrending(trendingMovies, trendingTv, maxItems),
    [trendingMovies, trendingTv, maxItems]
  );

  const [api, setApi] = React.useState<CarouselApi>();
  const [current, setCurrent] = React.useState(0);
  const [count, setCount] = React.useState(0);

  React.useEffect(() => {
    if (!api || !showDots) return;
    setCount(api.scrollSnapList().length);
    setCurrent(api.selectedScrollSnap() + 1);
    api.on("select", () => {
      setCurrent(api.selectedScrollSnap() + 1);
    });
  }, [api, showDots]);

  if (items.length === 0) return null;

  return (
    <div
      className={`flex w-full flex-col items-center ${TRENDING_CAROUSEL_H} ${
        rounded ? "px-3 sm:px-4" : ""
      }`}
    >
      <div
        className={`h-full w-full ${rounded ? "overflow-hidden rounded-2xl" : ""}`}
      >
        <Carousel
          opts={{ align: "start", loop: true }}
          className="h-full w-full [&>div]:h-full"
          setApi={setApi}
        >
        <CarouselContent className="ml-0 h-full [&>div]:h-full">
          {items.map((item) => {
            const title = item.title ?? item.name ?? "Untitled";
            const releaseDate = item.release_date ?? item.first_air_date ?? "";
            const year = releaseDate
              ? String(new Date(releaseDate).getFullYear())
              : "—";
            const releaseIso =
              releaseDate && String(releaseDate).length >= 10
                ? String(releaseDate).slice(0, 10)
                : null;
            const type = item.type ?? "movie";

            return (
              <CarouselItem
                key={`${type}-${item.id}`}
                className="h-full basis-full pl-0"
              >
                <LargeCard
                  hero
                  id={item.id}
                  title={title}
                  year={year}
                  releaseDate={releaseIso}
                  runtimeSeconds={item.runtimeSeconds}
                  seasonAmount={item.season_amount ?? 0}
                  numberOfEpisodes={item.number_of_episodes ?? undefined}
                  type={type}
                  posterPath={item.poster_path}
                  backdropPath={item.backdrop_path}
                  genres={item.genres}
                  voteAverage={item.vote_average}
                  certification={item.certification}
                />
              </CarouselItem>
            );
          })}
        </CarouselContent>
        <CarouselPrevious
          variant="flat"
          aria-label="Previous trending title"
          className={`${TRENDING_ARROW_CLASS} left-3 sm:left-4`}
        />
        <CarouselNext
          variant="flat"
          aria-label="Next trending title"
          className={`${TRENDING_ARROW_CLASS} right-3 sm:right-4`}
        />
      </Carousel>
      </div>

      {showDots && count > 0 ? (
        <div className="mt-4 flex items-center justify-center space-x-2">
          {Array.from({ length: count }).map((_, index) => (
            <div
              key={index}
              className={`h-2 rounded-full transition-all duration-300 ${
                index === current - 1 ? "w-2 bg-gray-400" : "w-2 bg-gray-500"
              }`}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
