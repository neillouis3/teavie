'use client';

import React from "react";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from "@/components/ui/carousel";
import LargeCard from "@/components/ui/largeCard";
import { sidebarBleedViewportClass } from "@/components/ui/sidebarBleedRail";
import { RAIL_ITEM_PAD, RAIL_TRACK } from "@/lib/catalogGrid";
import type { ContentItem } from "@/types/content";

type UpcomingRailProps = {
  items: ContentItem[];
};

export default function UpcomingRail({ items }: UpcomingRailProps) {
  const [api, setApi] = React.useState<CarouselApi>();
  const [current, setCurrent] = React.useState(0);
  const [count, setCount] = React.useState(0);
  const [logoByKey, setLogoByKey] = React.useState<Record<string, string>>({});

  React.useEffect(() => {
    if (!api) return;

    setCount(api.scrollSnapList().length);
    setCurrent(api.selectedScrollSnap() + 1);

    api.on("select", () => {
      setCurrent(api.selectedScrollSnap() + 1);
    });
  }, [api]);

  React.useEffect(() => {
    const payload = items
      .map((item) => {
        const id = String(item.id ?? "").trim();
        if (!/^\d+$/.test(id)) return null;
        return { id, type: item.type === "tv" ? "tv" : "movie" };
      })
      .filter((row): row is { id: string; type: "movie" | "tv" } => row != null)
      .slice(0, 24);

    if (payload.length === 0) {
      setLogoByKey({});
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/tmdb/logos", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ items: payload }),
        });
        if (!res.ok || cancelled) return;
        const json = (await res.json()) as { logos?: Record<string, string> };
        if (!cancelled) setLogoByKey(json.logos ?? {});
      } catch {
        if (!cancelled) setLogoByKey({});
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [items]);

  return (
    <div className="flex w-full flex-col items-center">
      <Carousel
        opts={{
          align: "center",
          loop: true,
        }}
        className="w-full"
        setApi={setApi}
      >
        <CarouselContent
          viewportClassName={sidebarBleedViewportClass()}
          className={RAIL_TRACK}
        >
          {items.map((item) => {
            const title = item.title ?? item.name ?? "Untitled";
            const releaseDate = item.release_date ?? item.first_air_date ?? "";
            const year = releaseDate
              ? String(new Date(releaseDate).getFullYear())
              : "TBA";
            const releaseIso =
              releaseDate && String(releaseDate).length >= 10
                ? String(releaseDate).slice(0, 10)
                : null;
            const type = item.type ?? "movie";
            const logoKey = `${type}:${String(item.id)}`;

            return (
              <CarouselItem
                key={`${type}-${item.id}`}
                className={`basis-[88%] sm:basis-[71.428571%] ${RAIL_ITEM_PAD}`}
              >
                <LargeCard
                  simpleOverlay
                  releaseDateStyle="phrase"
                  id={item.id}
                  title={title}
                  year={year}
                  releaseDate={releaseIso}
                  type={type}
                  posterPath={item.poster_path}
                  backdropPath={item.backdrop_path}
                  overview={item.overview}
                  logoPath={logoByKey[logoKey] ?? null}
                />
              </CarouselItem>
            );
          })}
        </CarouselContent>
      </Carousel>

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
    </div>
  );
}
