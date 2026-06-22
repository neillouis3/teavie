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
      className={`group relative flex aspect-[4/3] w-full overflow-hidden rounded-xl bg-gradient-to-br ${colorClass} p-3 shadow-sm transition-transform duration-200 hover:scale-[1.02]`}
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
