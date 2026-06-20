"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Chip } from "@heroui/react";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
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

/** Color-code each genre. Full class strings so Tailwind keeps them. */
const GENRE_COLORS: Record<string, string> = {
  Action: "bg-red-600",
  "Action & Adventure": "bg-red-600",
  Adventure: "bg-orange-500",
  Animation: "bg-sky-500",
  Comedy: "bg-amber-500",
  Crime: "bg-zinc-700",
  Documentary: "bg-teal-600",
  Drama: "bg-indigo-600",
  Family: "bg-green-600",
  Fantasy: "bg-violet-600",
  History: "bg-amber-700",
  Horror: "bg-neutral-800",
  Music: "bg-pink-500",
  Mystery: "bg-purple-700",
  Romance: "bg-rose-500",
  "Science Fiction": "bg-cyan-600",
  "Sci-Fi & Fantasy": "bg-cyan-600",
  "TV Movie": "bg-blue-600",
  Thriller: "bg-red-800",
  War: "bg-stone-600",
  "War & Politics": "bg-stone-600",
  Western: "bg-orange-800",
  Kids: "bg-lime-600",
  News: "bg-blue-700",
  Reality: "bg-fuchsia-600",
  Soap: "bg-rose-600",
  Talk: "bg-emerald-600",
};

const FALLBACK_COLORS = [
  "bg-rose-600",
  "bg-violet-600",
  "bg-sky-600",
  "bg-emerald-600",
  "bg-amber-600",
  "bg-fuchsia-600",
  "bg-cyan-600",
  "bg-indigo-600",
] as const;

function colorFor(name: string, index: number) {
  return GENRE_COLORS[name] ?? FALLBACK_COLORS[index % FALLBACK_COLORS.length];
}

const TMDB_IMG = "https://image.tmdb.org/t/p/w342";

function posterUrl(path: string) {
  return /^https?:\/\//i.test(path) ? path : `${TMDB_IMG}${path}`;
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
  const href =
    mode === "movie"
      ? `/movies/all?genre=${genre.id}`
      : `/shows/all?genre=${genre.id}`;
  const poster = genre.posters[0];

  return (
    <Link
      href={href}
      aria-label={`Browse ${genre.name}`}
      className={`group relative flex aspect-[4/3] w-full overflow-hidden rounded-xl ${colorClass} p-3 shadow-sm transition-transform duration-200 hover:scale-[1.02]`}
    >
      <div className="relative z-20 flex flex-col">
        <span className="text-base font-bold leading-tight text-white drop-shadow-sm sm:text-lg">
          {genre.name}
        </span>
        <span className="mt-0.5 text-[11px] font-medium text-white/80">
          {genre.count.toLocaleString()} titles
        </span>
      </div>

      {poster && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={posterUrl(poster)}
          alt=""
          aria-hidden
          loading="lazy"
          className="pointer-events-none absolute -bottom-4 -right-3 z-10 h-[64%] w-auto rotate-12 rounded-md object-cover shadow-xl ring-1 ring-black/10 transition-transform duration-200 group-hover:-translate-y-1 group-hover:rotate-6"
        />
      )}

      <span className="pointer-events-none absolute inset-0 z-0 bg-gradient-to-br from-white/10 to-black/25" />
    </Link>
  );
}

function GenreTilesSkeleton() {
  return (
    <div className="flex gap-3 overflow-hidden">
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={i}
          className="aspect-[4/3] w-[42%] shrink-0 animate-pulse rounded-xl bg-default-200 sm:w-[30%] md:w-1/4 lg:w-1/5 xl:w-1/6"
        />
      ))}
    </div>
  );
}

export default function GenreDiscover() {
  const [data, setData] = useState<PopularGenresPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<Mode>("movie");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch("/api/genres/popular")
      .then((res) => res.json())
      .then((json) => {
        if (cancelled) return;
        setData({ movies: json.movies ?? [], tv: json.tv ?? [] });
      })
      .catch(() => {
        if (!cancelled) setData(EMPTY);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const rows = useMemo(
    () => (mode === "movie" ? data?.movies ?? [] : data?.tv ?? []),
    [data, mode]
  );

  if (!loading && (!data || (data.movies.length === 0 && data.tv.length === 0))) {
    return null;
  }

  return (
    <section className="flex w-full flex-col gap-3" aria-label="Browse by genre">
      <div className="flex flex-row flex-wrap items-center justify-between gap-2">
        <Chip color="success" variant="flat" size="md" radius="sm">
          Browse by genre
        </Chip>

        <div className="inline-flex rounded-lg border border-default-200 p-0.5 dark:border-white/10">
          {(["movie", "tv"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                mode === m
                  ? "bg-success text-success-foreground shadow-sm"
                  : "text-default-500 hover:text-foreground"
              }`}
            >
              {m === "movie" ? "Movies" : "TV"}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <GenreTilesSkeleton />
      ) : rows.length === 0 ? (
        <p className="py-6 text-center text-sm text-default-500">
          No genres to show yet.
        </p>
      ) : (
        <Carousel opts={{ align: "start", dragFree: true }} className="w-full">
          <CarouselContent className="-ml-3">
            {rows.map((genre, i) => (
              <CarouselItem
                key={`${mode}-${genre.id}`}
                className="basis-[42%] pl-3 sm:basis-[30%] md:basis-1/4 lg:basis-1/5 xl:basis-1/6"
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
      )}
    </section>
  );
}
