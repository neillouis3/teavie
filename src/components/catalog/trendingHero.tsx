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
import { tmdbImageUrl, catalogHeroImageUrl } from "@/lib/tmdbImage";
import { isAnimePortraitCoverUrl } from "@/lib/animePoster";
import { cn } from "@/lib/utils";
import type { ContentItem } from "@/types/content";

const TRENDING_CAROUSEL_H =
  "h-[min(52vh,400px)] sm:h-[min(62vh,480px)] lg:h-[85vh]";

const SPOTLIGHT_UNDER_NAV_H =
  "h-[calc(min(52vh,400px)+3.5rem)] sm:h-[calc(min(62vh,480px)+3.5rem)] lg:h-[calc(85vh+3.5rem)]";

/** Loading shell height — must match loaded spotlight hero. */
export const SPOTLIGHT_SKELETON_H = SPOTLIGHT_UNDER_NAV_H;

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

interface TrendingHeroProps {
  trendingMovies: ContentItem[];
  trendingTv: ContentItem[];
  /** Pre-ranked spotlight slides (Explore). Overrides movie/TV interleave. */
  spotlightItems?: ContentItem[];
  maxItems?: number;
  /** Rounded carousel viewport (category hubs). */
  rounded?: boolean;
  /** Pagination dots under the carousel. @default true */
  showDots?: boolean;
  /** Full-width single-slide spotlight (Explore). */
  variant?: "carousel" | "spotlight";
  /** Extend spotlight behind the fixed top nav (Explore). */
  bleedUnderNav?: boolean;
  /** Align carousel to the page’s left edge (category hubs). */
  flushLeft?: boolean;
  /**
   * Anime hub: keep poster aspect (no landscape crop/zoom).
   * Prefer poster art and fit with object-contain.
   */
  preserveImageAspect?: boolean;
  /** Thumbnail strip under spotlight slides. @default true */
  showSpotlightSelector?: boolean;
}

export default function TrendingHero({
  trendingMovies,
  trendingTv,
  spotlightItems,
  maxItems = 24,
  rounded = false,
  showDots = true,
  variant = "carousel",
  bleedUnderNav = false,
  flushLeft = false,
  preserveImageAspect = false,
  showSpotlightSelector = true,
}: TrendingHeroProps) {
  const items = React.useMemo(() => {
    if (variant === "spotlight" && spotlightItems && spotlightItems.length > 0) {
      return spotlightItems;
    }
    return interleaveTrending(trendingMovies, trendingTv, maxItems);
  }, [variant, spotlightItems, trendingMovies, trendingTv, maxItems]);

  const [api, setApi] = React.useState<CarouselApi>();
  const [current, setCurrent] = React.useState(0);
  const [count, setCount] = React.useState(0);
  const [logoByKey, setLogoByKey] = React.useState<Record<string, string>>({});
  const spotlightRailRef = React.useRef<HTMLDivElement>(null);
  const spotlightDragRef = React.useRef({
    active: false,
    dragged: false,
    startX: 0,
    startScrollLeft: 0,
  });

  React.useEffect(() => {
    if (!api) return;
    setCount(api.scrollSnapList().length);
    setCurrent(api.selectedScrollSnap() + 1);
    const handleSelect = () => {
      setCurrent(api.selectedScrollSnap() + 1);
    };
    api.on("select", handleSelect);
    return () => {
      api.off("select", handleSelect);
    };
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

  if (items.length === 0) return null;

  function renderCard(item: ContentItem) {
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
    const logoKey = `${type}:${String(item.id)}`;

    return (
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
        overview={item.overview}
        imageFit={preserveImageAspect ? "contain" : "cover"}
        preferPoster={preserveImageAspect}
        logoPath={logoByKey[logoKey] ?? null}
        showHeroActions={variant === "spotlight"}
      />
    );
  }

  const carouselItemClass =
    variant === "spotlight"
      ? "h-full basis-full pl-0"
      : flushLeft
        ? "h-full basis-full pl-0"
        : "h-full basis-full";

  const carouselSlides = items.map((item) => {
    const type = item.type ?? "movie";
    return (
      <CarouselItem
        key={`${type}-${item.id}`}
        className={carouselItemClass}
      >
        {renderCard(item)}
      </CarouselItem>
    );
  });

  const paginationDots =
    showDots && count > 0 ? (
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
    ) : null;

  if (variant === "spotlight") {
    const spotlightHeight = bleedUnderNav ? SPOTLIGHT_UNDER_NAV_H : TRENDING_CAROUSEL_H;
    return (
      <div
        className={cn("relative flex w-full flex-col", spotlightHeight)}
        aria-label="Spotlight"
      >
        <Carousel
          opts={{ align: "start", loop: true }}
          className="relative h-full w-full [&>div]:h-full"
          setApi={setApi}
        >
          <CarouselContent
            viewportClassName="h-full w-full overflow-hidden"
            className="!ml-0 h-full"
          >
            {carouselSlides}
          </CarouselContent>
          <CarouselPrevious
            variant="flat"
            aria-label="Previous spotlight title"
            className={cn(TRENDING_ARROW_CLASS, "left-4")}
          />
          <CarouselNext
            variant="flat"
            aria-label="Next spotlight title"
            className={cn(TRENDING_ARROW_CLASS, "right-4")}
          />
        </Carousel>
        {showSpotlightSelector ? (
        <div
          ref={spotlightRailRef}
          className="absolute inset-x-0 bottom-4 z-20 cursor-grab touch-none overflow-x-scroll overscroll-x-contain px-4 [scrollbar-width:none] active:cursor-grabbing [&::-webkit-scrollbar]:hidden lg:px-24"
          aria-label="Choose a spotlight title"
          onPointerDown={(event) => {
            spotlightDragRef.current = {
              active: true,
              dragged: false,
              startX: event.clientX,
              startScrollLeft: event.currentTarget.scrollLeft,
            };
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerMove={(event) => {
            const drag = spotlightDragRef.current;
            if (!drag.active) return;
            if (Math.abs(event.clientX - drag.startX) > 5) {
              drag.dragged = true;
            }
            event.currentTarget.scrollLeft =
              drag.startScrollLeft - (event.clientX - drag.startX);
          }}
          onPointerUp={(event) => {
            spotlightDragRef.current.active = false;
            event.currentTarget.releasePointerCapture(event.pointerId);
          }}
          onPointerCancel={() => {
            spotlightDragRef.current.active = false;
          }}
        >
          <div className="grid w-max grid-flow-col auto-cols-[11rem] gap-3 pr-4 sm:auto-cols-[13rem] lg:auto-cols-[calc((100vw-13.5rem)/5.5)]">
            {items.map((item, index) => {
              const title = item.title ?? item.name ?? "Untitled";
              const image =
                catalogHeroImageUrl(item.backdrop_path) ||
                tmdbImageUrl(item.backdrop_path) ||
                (!isAnimePortraitCoverUrl(item.poster_path)
                  ? tmdbImageUrl(item.poster_path)
                  : "");
              return (
                <button
                  key={`spotlight-selector-${item.type ?? "movie"}-${item.id}`}
                  type="button"
                  data-spotlight-index={index}
                  aria-label={`Show ${title} in Spotlight`}
                  onClick={(event) => {
                    if (spotlightDragRef.current.dragged) {
                      event.preventDefault();
                      event.stopPropagation();
                      spotlightDragRef.current.dragged = false;
                      return;
                    }
                    api?.scrollTo(index);
                  }}
                  className={cn(
                    "relative aspect-video w-full overflow-hidden rounded-xl bg-default-100 text-left shadow-lg outline-none",
                    "focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  )}
                >
                  {image ? (
                    <div
                      className="absolute inset-0 bg-cover bg-center"
                      style={{ backgroundImage: `url(${JSON.stringify(image)})` }}
                      aria-hidden="true"
                    />
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
        ) : null}
        {paginationDots}
      </div>
    );
  }

  return (
    <div
      className={`flex w-full flex-col items-center pr-3 sm:pr-4 ${TRENDING_CAROUSEL_H}`}
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
            {carouselSlides}
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
      {paginationDots}
    </div>
  );
}
