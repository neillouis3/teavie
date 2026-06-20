"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Chip } from "@heroui/react";

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

/**
 * Fixed gradient palette cycled by rank so the top genres get distinct,
 * recognizable colors. Full class strings so Tailwind keeps them.
 */
const GRADIENTS = [
  "from-rose-500 to-orange-500",
  "from-violet-500 to-fuchsia-500",
  "from-sky-500 to-indigo-600",
  "from-emerald-500 to-teal-600",
  "from-amber-500 to-pink-600",
  "from-cyan-500 to-blue-600",
  "from-fuchsia-500 to-purple-600",
  "from-lime-500 to-emerald-600",
  "from-red-500 to-rose-600",
  "from-indigo-500 to-violet-600",
] as const;

const TMDB_IMG = "https://image.tmdb.org/t/p/w342";

function posterUrl(path: string) {
  return /^https?:\/\//i.test(path) ? path : `${TMDB_IMG}${path}`;
}

function GenreTile({
  genre,
  mode,
  gradient,
}: {
  genre: GenreRow;
  mode: Mode;
  gradient: string;
}) {
  const href =
    mode === "movie"
      ? `/movies/all?genre=${genre.id}`
      : `/shows/all?genre=${genre.id}`;
  const posters = genre.posters.slice(0, 2);

  return (
    <Link
      href={href}
      aria-label={`Browse ${genre.name}`}
      className={`group relative flex aspect-square w-36 shrink-0 flex-col justify-end overflow-hidden rounded-xl bg-gradient-to-br ${gradient} p-3 shadow-sm transition-transform duration-200 hover:scale-[1.03] sm:w-40`}
    >
      {posters.length > 0 && (
        <div className="pointer-events-none absolute inset-0 z-10 overflow-hidden">
          {posters.map((p, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={`${genre.id}-${i}`}
              src={posterUrl(p)}
              alt=""
              aria-hidden
              loading="lazy"
              className="absolute -right-4 top-[-10%] h-[120%] w-auto rounded-md object-cover shadow-lg ring-1 ring-black/10 transition-transform duration-200 group-hover:translate-y-[-3%]"
              style={{
                right: `${i * 26 - 16}px`,
                transform: `rotate(${10 - i * 5}deg)`,
                zIndex: 10 - i,
                opacity: i === 0 ? 0.9 : 0.75,
              }}
            />
          ))}
        </div>
      )}

      <span className="pointer-events-none absolute inset-0 z-20 bg-gradient-to-t from-black/55 via-black/10 to-transparent" />

      <div className="relative z-30 flex flex-col">
        <span className="text-sm font-semibold leading-tight text-white drop-shadow-sm sm:text-base">
          {genre.name}
        </span>
        <span className="mt-0.5 text-[11px] font-medium text-white/80">
          {genre.count.toLocaleString()} titles
        </span>
      </div>
    </Link>
  );
}

function GenreTilesSkeleton() {
  return (
    <div className="flex gap-3 overflow-hidden">
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={i}
          className="aspect-square w-36 shrink-0 animate-pulse rounded-xl bg-default-200 sm:w-40"
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
        <div className="-mx-3 flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth px-3 pb-2 [scrollbar-width:none] sm:-mx-4 sm:px-4 [&::-webkit-scrollbar]:hidden">
          {rows.map((genre, i) => (
            <div key={`${mode}-${genre.id}`} className="snap-start">
              <GenreTile
                genre={genre}
                mode={mode}
                gradient={GRADIENTS[i % GRADIENTS.length]}
              />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
