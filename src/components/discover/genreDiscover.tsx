"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Chip, Tabs, Tab } from "@heroui/react";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from "@/components/ui/carousel";

type GenreRow = {
  id: number;
  name: string;
  count: number;
  posters: string[];
};

type PopularGenresPayload = {
  movies: GenreRow[];
  tv: GenreRow[];
};

type Mode = "movie" | "tv";

const EMPTY: PopularGenresPayload = { movies: [], tv: [] };

/** Browse-by-genre block height (matches Discover “New & Upcoming” hero feel). */
const GENRE_SECTION_MIN_H = "min-h-[75vh]";
const GENRE_CAROUSEL_H = "h-[calc(75vh-5.5rem)]";

/** Color-code each genre with a gradient. Full class strings so Tailwind keeps them. */
const GENRE_COLORS: Record<string, string> = {
  Action: "from-red-500 to-rose-700",
  "Action & Adventure": "from-red-500 to-orange-600",
  Adventure: "from-orange-400 to-amber-600",
  Animation: "from-sky-400 to-blue-600",
  Comedy: "from-amber-400 to-orange-600",
  Crime: "from-zinc-600 to-slate-800",
  Documentary: "from-teal-500 to-emerald-700",
  Drama: "from-indigo-500 to-violet-700",
  Family: "from-green-500 to-emerald-700",
  Fantasy: "from-violet-500 to-purple-700",
  History: "from-amber-600 to-orange-800",
  Horror: "from-neutral-700 to-zinc-900",
  Music: "from-pink-400 to-fuchsia-600",
  Mystery: "from-purple-600 to-indigo-800",
  Romance: "from-rose-400 to-pink-600",
  "Science Fiction": "from-cyan-500 to-blue-700",
  "Sci-Fi & Fantasy": "from-cyan-500 to-blue-700",
  "TV Movie": "from-blue-500 to-indigo-700",
  Thriller: "from-red-700 to-rose-900",
  War: "from-stone-500 to-stone-700",
  "War & Politics": "from-stone-500 to-stone-700",
  Western: "from-orange-700 to-amber-900",
  Kids: "from-lime-500 to-green-700",
  News: "from-blue-600 to-sky-800",
  Reality: "from-fuchsia-500 to-pink-700",
  Soap: "from-rose-500 to-red-700",
  Talk: "from-emerald-500 to-teal-700",
};

const FALLBACK_COLORS = [
  "from-rose-500 to-pink-700",
  "from-violet-500 to-purple-700",
  "from-sky-500 to-blue-700",
  "from-emerald-500 to-teal-700",
  "from-amber-500 to-orange-700",
  "from-fuchsia-500 to-pink-700",
  "from-cyan-500 to-blue-700",
  "from-indigo-500 to-violet-700",
] as const;

function colorFor(name: string, index: number) {
  return GENRE_COLORS[name] ?? FALLBACK_COLORS[index % FALLBACK_COLORS.length];
}

const TMDB_IMG = "https://image.tmdb.org/t/p/w500";

function posterUrl(path: string) {
  return /^https?:\/\//i.test(path) ? path : `${TMDB_IMG}${path}`;
}

function genreBrowseHref(mode: Mode, genreId: number) {
  const base = mode === "movie" ? "/movies/all" : "/shows/all";
  const params = new URLSearchParams({
    genre: String(genreId),
    sort_by: "popularity",
  });
  return `${base}?${params.toString()}`;
}

function GenreTile({
  genre,
  mode,
  colorClass,
}: {
  genre: GenreRow;
  mode: Mode;
  colorClass: string;
}) {
  const href = genreBrowseHref(mode, genre.id);
  const [lead, ...stack] = genre.posters.filter(Boolean).slice(0, 3);

  return (
    <Link
      href={href}
      aria-label={`Browse ${genre.name}, sorted by popularity`}
      className={`group relative flex h-full min-h-[280px] w-full overflow-hidden rounded-xl bg-gradient-to-br ${colorClass} p-4 shadow-sm transition-transform duration-200 hover:scale-[1.01] sm:p-5`}
    >
      <div className="relative z-20 flex flex-col pr-[44%]">
        <span className="text-lg font-bold leading-tight text-white drop-shadow-sm sm:text-2xl">
          {genre.name}
        </span>
        <span className="mt-1 text-xs font-medium text-white/80 sm:text-sm">
          {genre.count.toLocaleString()} titles
        </span>
      </div>

      {stack.length > 0 && (
        <div className="pointer-events-none absolute -bottom-6 right-8 z-[8] h-[74%] w-[36%] rotate-[4deg] overflow-hidden rounded-lg opacity-75 shadow-lg ring-1 ring-black/15 sm:right-10">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={posterUrl(stack[0])}
            alt=""
            aria-hidden
            className="h-full w-full object-cover"
          />
        </div>
      )}

      {lead && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={posterUrl(lead)}
          alt=""
          aria-hidden
          className="pointer-events-none absolute -bottom-8 -right-5 z-10 h-[90%] w-auto max-w-[46%] rotate-12 rounded-lg object-cover shadow-2xl ring-1 ring-black/15 transition-transform duration-200 group-hover:-translate-y-1.5 group-hover:rotate-6 sm:-right-6"
        />
      )}

      <span className="pointer-events-none absolute inset-0 z-0 bg-gradient-to-br from-white/10 to-black/25" />
    </Link>
  );
}

function posterUrlsForRows(rows: GenreRow[]): string[] {
  const urls: string[] = [];
  for (const row of rows) {
    for (const p of row.posters) {
      if (typeof p === "string" && p.trim()) urls.push(posterUrl(p));
    }
  }
  return urls;
}

function preloadImages(urls: string[]): Promise<void> {
  const unique = [...new Set(urls)];
  if (unique.length === 0) return Promise.resolve();
  return Promise.all(
    unique.map(
      (src) =>
        new Promise<void>((resolve) => {
          const img = new Image();
          img.onload = () => resolve();
          img.onerror = () => resolve();
          img.src = src;
        })
    )
  ).then(() => undefined);
}

function GenreCarousel({ rows, mode }: { rows: GenreRow[]; mode: Mode }) {
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

  if (rows.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-default-500">
        No genres to show yet.
      </p>
    );
  }

  return (
    <div className={`flex w-full flex-col items-center ${GENRE_CAROUSEL_H}`}>
      <Carousel
        opts={{ align: "center", loop: true }}
        className="h-full w-full [&>div]:h-full"
        setApi={setApi}
      >
        <CarouselContent className="-ml-4 h-full [&>div]:h-full">
          {rows.map((genre, i) => (
            <CarouselItem
              key={`${mode}-${genre.id}`}
              className="h-full basis-[88%] pl-3 sm:basis-2/3 sm:pl-4"
            >
              <GenreTile
                genre={genre}
                mode={mode}
                colorClass={colorFor(genre.name, i)}
              />
            </CarouselItem>
          ))}
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

function GenreTilesSkeleton() {
  return (
    <div className={`flex w-full flex-col items-center ${GENRE_CAROUSEL_H}`}>
      <div className="h-[calc(100%-2rem)] w-full overflow-hidden px-3 sm:px-4">
        <div className="mx-auto h-full max-w-4xl animate-pulse rounded-xl bg-default-200" />
      </div>
      <div className="mt-4 flex items-center justify-center gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-2 w-2 animate-pulse rounded-full bg-default-300" />
        ))}
      </div>
    </div>
  );
}

function GenreSectionSkeleton() {
  return (
    <section
      className={`flex w-full flex-col gap-3 ${GENRE_SECTION_MIN_H}`}
      aria-hidden
    >
      <div className="flex flex-row flex-wrap items-center justify-between gap-2">
        <div className="h-7 w-36 animate-pulse rounded-lg bg-default-200" />
        <div className="h-8 w-[8.5rem] animate-pulse rounded-lg bg-default-200" />
      </div>
      <GenreTilesSkeleton />
    </section>
  );
}

const GENRE_TABS_CLASSNAMES = {
  base: "w-auto max-w-full",
  tabList: "gap-0 p-0.5",
  tab: "h-8 px-3 text-xs font-medium",
  panel: "hidden",
} as const;

export default function GenreDiscover() {
  const [data, setData] = useState<PopularGenresPayload | null>(null);
  const [ready, setReady] = useState(false);
  const [mode, setMode] = useState<Mode>("movie");

  useEffect(() => {
    let cancelled = false;
    setReady(false);
    setData(null);

    fetch("/api/genres/popular")
      .then((res) => res.json())
      .then(async (json) => {
        if (cancelled) return;
        const payload: PopularGenresPayload = {
          movies: json.movies ?? [],
          tv: json.tv ?? [],
        };
        const posterUrls = [
          ...posterUrlsForRows(payload.movies),
          ...posterUrlsForRows(payload.tv),
        ];
        await preloadImages(posterUrls);
        if (cancelled) return;
        setData(payload);
        setReady(true);
      })
      .catch(() => {
        if (!cancelled) {
          setData(EMPTY);
          setReady(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (!ready) {
    return <GenreSectionSkeleton />;
  }

  if (!data || (data.movies.length === 0 && data.tv.length === 0)) {
    return null;
  }

  const rows = mode === "movie" ? data.movies : data.tv;

  return (
    <section
      className={`flex w-full flex-col gap-3 ${GENRE_SECTION_MIN_H}`}
      aria-label="Browse by genre"
    >
      <div className="flex flex-row flex-wrap items-center justify-between gap-2">
        <Chip color="success" variant="flat" size="md" radius="sm">
          Browse by genre
        </Chip>

        <Tabs
          aria-label="Genre catalog type"
          selectedKey={mode}
          onSelectionChange={(key) => setMode(String(key) as Mode)}
          size="sm"
          color="success"
          variant="bordered"
          radius="lg"
          classNames={GENRE_TABS_CLASSNAMES}
        >
          <Tab key="movie" title="Movies" />
          <Tab key="tv" title="TV" />
        </Tabs>
      </div>

      <GenreCarousel key={mode} rows={rows} mode={mode} />
    </section>
  );
}
