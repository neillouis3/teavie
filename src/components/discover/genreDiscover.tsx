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

/** Muted gradient per genre (full class strings for Tailwind). */
const GENRE_COLORS: Record<string, string> = {
  Action: "from-red-400 to-rose-500",
  "Action & Adventure": "from-red-400 to-orange-500",
  Adventure: "from-orange-300 to-amber-500",
  Animation: "from-sky-300 to-blue-500",
  Comedy: "from-amber-300 to-orange-500",
  Crime: "from-zinc-500 to-slate-600",
  Documentary: "from-teal-400 to-emerald-500",
  Drama: "from-indigo-400 to-violet-500",
  Family: "from-green-400 to-emerald-500",
  Fantasy: "from-violet-400 to-purple-500",
  History: "from-amber-500 to-orange-600",
  Horror: "from-neutral-600 to-zinc-700",
  Music: "from-pink-300 to-fuchsia-500",
  Mystery: "from-purple-500 to-indigo-600",
  Romance: "from-rose-300 to-pink-500",
  "Science Fiction": "from-cyan-400 to-blue-500",
  "Sci-Fi & Fantasy": "from-cyan-400 to-blue-500",
  "TV Movie": "from-blue-400 to-indigo-500",
  Thriller: "from-red-500 to-rose-600",
  War: "from-stone-400 to-stone-600",
  "War & Politics": "from-stone-400 to-stone-600",
  Western: "from-orange-500 to-amber-600",
  Kids: "from-lime-400 to-green-500",
  News: "from-blue-500 to-sky-600",
  Reality: "from-fuchsia-400 to-pink-500",
  Soap: "from-rose-400 to-red-500",
  Talk: "from-emerald-400 to-teal-500",
};

const FALLBACK_COLORS = [
  "from-rose-400 to-pink-500",
  "from-violet-400 to-purple-500",
  "from-sky-400 to-blue-500",
  "from-emerald-400 to-teal-500",
  "from-amber-400 to-orange-500",
  "from-fuchsia-400 to-pink-500",
  "from-cyan-400 to-blue-500",
  "from-indigo-400 to-violet-500",
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

function deckPosters(posters: string[]): string[] {
  const raw = posters.filter(Boolean).slice(0, 3);
  if (raw.length === 0) return [];
  const out = [...raw];
  while (out.length < 3) out.push(out[out.length - 1]);
  return out;
}

const DECK_CARD_BASE =
  "absolute bottom-0 right-0 h-full w-auto max-w-full rounded-lg object-cover shadow-2xl ring-1 ring-black/10 origin-bottom-right transition-all duration-300 ease-out will-change-transform";

const DECK_CARD_HOVER = [
  "z-30 rotate-[10deg] group-hover:-translate-y-1.5 group-hover:rotate-[6deg]",
  "z-20 rotate-[10deg] group-hover:-translate-x-[24%] group-hover:-translate-y-0.5 group-hover:-rotate-[-2deg]",
  "z-10 rotate-[10deg] group-hover:translate-x-[6%] group-hover:-translate-y-2 group-hover:rotate-[14deg]",
] as const;

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
  const posters = deckPosters(genre.posters);

  return (
    <Link
      href={href}
      aria-label={`Browse ${genre.name}`}
      className="group relative flex aspect-[4/3] w-full overflow-hidden rounded-xl p-3"
    >
      <span
        className={`pointer-events-none absolute inset-0 rounded-xl bg-gradient-to-br ${colorClass} shadow-sm`}
        aria-hidden
      />
      <div className="relative z-20 flex flex-col pr-[40%]">
        <span className="text-base font-bold leading-tight text-white drop-shadow-sm sm:text-lg">
          {genre.name}
        </span>
        <span className="mt-0.5 text-[11px] font-medium text-white/80">
          {genre.count.toLocaleString()} titles
        </span>
      </div>

      {posters.length > 0 && (
        <div className="pointer-events-none absolute bottom-3 right-3 z-10 h-[68%] w-[40%]">
          {posters.map((path, index) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={`${path}-${index}`}
              src={posterUrl(path)}
              alt=""
              aria-hidden
              loading="lazy"
              className={`${DECK_CARD_BASE} ${DECK_CARD_HOVER[index]}`}
            />
          ))}
        </div>
      )}

      <span className="pointer-events-none absolute inset-0 z-[1] rounded-xl bg-gradient-to-br from-white/15 to-black/20" />
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
              {m === "movie" ? "Movies" : "TV shows"}
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
