"use client";

import React from "react";
import Link from "next/link";
import { genrePageHref } from "@/lib/imdbGenres";
import { genreTileGlowStops } from "@/lib/sidebarEdgeGlow";
import { tmdbImageUrl } from "@/lib/tmdbImage";

export type CatalogGenreRow = {
  slug: string;
  name: string;
  count: number;
  posters: string[];
};

/** Muted gradient per IMDb genre label (full class strings for Tailwind). */
export const GENRE_TILE_COLORS: Record<string, string> = {
  Action: "from-red-400 to-rose-500",
  Adventure: "from-orange-300 to-amber-500",
  Animation: "from-sky-300 to-blue-500",
  Biography: "from-amber-400 to-yellow-600",
  Comedy: "from-amber-300 to-orange-500",
  Crime: "from-zinc-500 to-slate-600",
  Documentary: "from-teal-400 to-emerald-500",
  Drama: "from-indigo-400 to-violet-500",
  Family: "from-green-400 to-emerald-500",
  Fantasy: "from-violet-400 to-purple-500",
  "Film-Noir": "from-neutral-700 to-zinc-800",
  "Game-Show": "from-fuchsia-400 to-purple-500",
  History: "from-amber-500 to-orange-600",
  Horror: "from-neutral-600 to-zinc-700",
  Music: "from-pink-300 to-fuchsia-500",
  Musical: "from-rose-400 to-pink-500",
  Mystery: "from-purple-500 to-indigo-600",
  News: "from-blue-500 to-sky-600",
  "Reality-TV": "from-fuchsia-400 to-pink-500",
  Romance: "from-rose-300 to-pink-500",
  "Sci-Fi": "from-cyan-400 to-blue-500",
  Sport: "from-lime-400 to-green-500",
  "Talk-Show": "from-emerald-400 to-teal-500",
  Thriller: "from-red-500 to-rose-600",
  War: "from-stone-400 to-stone-600",
  Western: "from-orange-500 to-amber-600",
};

export const FALLBACK_COLORS = [
  "from-rose-400 to-pink-500",
  "from-violet-400 to-purple-500",
  "from-sky-400 to-blue-500",
  "from-emerald-400 to-teal-500",
  "from-amber-400 to-orange-500",
  "from-fuchsia-400 to-pink-500",
  "from-cyan-400 to-blue-500",
  "from-indigo-400 to-violet-500",
] as const;

export function genreTileColor(name: string, index: number) {
  return GENRE_TILE_COLORS[name] ?? FALLBACK_COLORS[index % FALLBACK_COLORS.length];
}

function posterUrl(path: string) {
  return tmdbImageUrl(path);
}

function deckPosters(posters: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const path of posters) {
    if (!path || seen.has(path)) continue;
    seen.add(path);
    out.push(path);
    if (out.length >= 3) break;
  }
  return out;
}

const DECK_CARD_BASE_RIGHT =
  "absolute bottom-0 right-0 h-full w-auto max-w-full rounded-lg object-cover shadow-2xl ring-1 ring-black/10 origin-bottom-right transition-all duration-300 ease-out will-change-transform";

const DECK_CARD_REST = "translate-y-5";

const DECK_CARD_HOVER_RIGHT = [
  `z-30 rotate-[10deg] ${DECK_CARD_REST} group-hover:-translate-y-1 group-hover:rotate-[6deg]`,
  `z-20 rotate-[10deg] ${DECK_CARD_REST} group-hover:-translate-x-[40%] group-hover:translate-y-4 group-hover:-rotate-[5deg]`,
  `z-10 rotate-[10deg] ${DECK_CARD_REST} group-hover:translate-x-[14%] group-hover:translate-y-3 group-hover:rotate-[20deg]`,
] as const;

export function GenreCatalogTile({
  genre,
  colorClass,
  href: hrefOverride,
  glowIndex = 0,
}: {
  genre: CatalogGenreRow;
  colorClass: string;
  href?: string;
  glowIndex?: number;
}) {
  const href = hrefOverride ?? genrePageHref(genre.slug);
  const posters = deckPosters(genre.posters);
  const glow = genreTileGlowStops(genre.name, glowIndex);

  return (
    <Link
      href={href}
      aria-label={`Browse ${genre.name}`}
      data-sidebar-glow
      data-glow-inner={glow.inner}
      data-glow-outer={glow.outer}
      data-glow-priority={1}
      className="group relative flex aspect-[40/21] w-full overflow-hidden rounded-xl p-3"
    >
      <span
        className={`pointer-events-none absolute inset-0 rounded-xl bg-gradient-to-br ${colorClass} shadow-sm`}
        aria-hidden
      />
      <div className="relative z-20 flex w-[46%] flex-col items-start text-left sm:w-[48%]">
        <span className="text-base font-bold leading-tight text-white drop-shadow-sm sm:text-lg">
          {genre.name}
        </span>
        <span className="mt-0.5 text-[11px] font-medium text-white/80">
          {genre.count.toLocaleString()} titles
        </span>
      </div>

      {posters.length > 0 && (
        <div className="pointer-events-none absolute bottom-0 right-1 z-10 h-[90%] w-[56%] sm:right-1.5 sm:w-[60%]">
          {posters.map((path, index) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={`${path}-${index}`}
              src={posterUrl(path)}
              alt=""
              aria-hidden
              loading="lazy"
              className={`${DECK_CARD_BASE_RIGHT} ${DECK_CARD_HOVER_RIGHT[index]}`}
            />
          ))}
        </div>
      )}

      <span className="pointer-events-none absolute inset-0 z-[1] rounded-xl bg-gradient-to-br from-white/15 to-black/20" />
    </Link>
  );
}

/** Explore rail capstone — links to full genres index. */
export function GenreBrowseAllTile() {
  return (
    <Link
      href="/genres"
      aria-label="Browse all genres"
      className="group relative flex aspect-[40/21] w-full overflow-hidden rounded-xl p-3"
    >
      <span
        className="pointer-events-none absolute inset-0 rounded-xl bg-gradient-to-br from-emerald-500/90 to-teal-600 shadow-sm"
        aria-hidden
      />
      <div className="relative z-20 flex h-full w-full flex-col items-center justify-center text-center px-2">
        <span className="text-base font-bold leading-tight text-white drop-shadow-sm sm:text-lg">
          Browse genres
        </span>
        <span className="mt-0.5 text-[11px] font-medium text-white/80">View all</span>
      </div>
      <span className="pointer-events-none absolute inset-0 z-[1] rounded-xl bg-gradient-to-br from-white/15 to-black/20 transition-opacity group-hover:opacity-90" />
    </Link>
  );
}

export function GenreSquareTile({
  genre,
  colorClass,
}: {
  genre: CatalogGenreRow;
  colorClass: string;
}) {
  const href = genrePageHref(genre.slug);

  return (
    <Link
      href={href}
      aria-label={`Browse ${genre.name}`}
      className="group relative flex aspect-square w-full overflow-hidden rounded-xl p-2.5 sm:p-3"
    >
      <span
        className={`pointer-events-none absolute inset-0 rounded-xl bg-gradient-to-br ${colorClass} shadow-sm`}
        aria-hidden
      />
      <div className="relative z-20 mt-auto flex flex-col items-start text-left">
        <span className="text-xs font-bold leading-tight text-white drop-shadow-sm sm:text-sm">
          {genre.name}
        </span>
        {genre.count > 0 ? (
          <span className="mt-0.5 text-[10px] font-medium text-white/80 sm:text-[11px]">
            {genre.count.toLocaleString()} titles
          </span>
        ) : null}
      </div>
      <span className="pointer-events-none absolute inset-0 z-[1] rounded-xl bg-gradient-to-br from-white/15 to-black/20" />
    </Link>
  );
}

export function GenreTilesSkeleton({ count = 12 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="aspect-[40/21] w-full animate-pulse rounded-xl bg-default-200"
        />
      ))}
    </div>
  );
}

export const GENRE_SQUARE_GRID =
  "grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7";

export function GenreSquareTilesSkeleton({ count = 27 }: { count?: number }) {
  return (
    <div className={GENRE_SQUARE_GRID}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="aspect-square w-full animate-pulse rounded-xl bg-default-200"
        />
      ))}
    </div>
  );
}
