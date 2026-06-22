"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Chip } from "@heroui/react";
import Header from "@/components/ui/header";
import CatalogRail, { CatalogRailSkeleton } from "@/components/explore/catalogRail";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
} from "@/components/ui/carousel";
import type { ContentItem } from "@/types/content";
import { useCatalogCardStyle } from "@/contexts/catalogCardStyleContext";

type GenreRow = {
  slug: string;
  name: string;
  count: number;
  posters: string[];
};

type KdramaDiscoverPayload = {
  popular: ContentItem[];
  romance: ContentItem[];
  drama: ContentItem[];
  genres: GenreRow[];
};

const EMPTY: KdramaDiscoverPayload = {
  popular: [],
  romance: [],
  drama: [],
  genres: [],
};

const TMDB_IMG = "https://image.tmdb.org/t/p/w500";

const GENRE_COLORS = [
  "from-rose-400 to-pink-500",
  "from-violet-400 to-purple-500",
  "from-indigo-400 to-violet-500",
  "from-sky-400 to-blue-500",
  "from-emerald-400 to-teal-500",
  "from-amber-400 to-orange-500",
  "from-fuchsia-400 to-pink-500",
  "from-cyan-400 to-blue-500",
] as const;

function posterUrl(path: string) {
  return /^https?:\/\//i.test(path) ? path : `${TMDB_IMG}${path}`;
}

function genreBrowseHref(slug: string) {
  const params = new URLSearchParams({
    genre: slug,
    sort_by: "popularity",
  });
  return `/kdrama/all?${params.toString()}`;
}

function GenreTile({ genre, colorClass }: { genre: GenreRow; colorClass: string }) {
  const posters = genre.posters.filter(Boolean).slice(0, 3);

  return (
    <Link
      href={genreBrowseHref(genre.slug)}
      aria-label={`Browse ${genre.name} K-Dramas`}
      className="group relative flex aspect-[4/3] w-full overflow-hidden rounded-xl p-3"
    >
      <span
        className={`pointer-events-none absolute inset-0 rounded-xl bg-gradient-to-br ${colorClass} shadow-sm`}
        aria-hidden
      />
      <div className="relative z-20 flex flex-col pr-[54%] sm:pr-[52%]">
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
              className="absolute bottom-0 right-0 h-full w-auto max-w-full rounded-lg object-cover shadow-2xl ring-1 ring-black/10"
              style={{
                transform: `rotate(${10 - index * 5}deg) translateY(${index * 4}px)`,
                zIndex: 30 - index * 10,
              }}
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
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="aspect-[4/3] w-[42%] shrink-0 animate-pulse rounded-xl bg-default-200 sm:w-[30%] md:w-1/4 lg:w-1/5 xl:w-1/6"
        />
      ))}
    </div>
  );
}

export default function KdramaHub() {
  const [data, setData] = useState<KdramaDiscoverPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const { mode: cardLayout } = useCatalogCardStyle();
  const horizontal = cardLayout === "horizontal";

  useEffect(() => {
    document.title = "Korean Drama - Teavie";
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch("/api/kdrama/discover")
      .then((res) => res.json())
      .then((json) => {
        if (cancelled) return;
        setData({
          popular: json.popular ?? [],
          romance: json.romance ?? [],
          drama: json.drama ?? [],
          genres: json.genres ?? [],
        });
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

  const hasContent =
    data &&
    (data.popular.length > 0 ||
      data.romance.length > 0 ||
      data.drama.length > 0 ||
      data.genres.length > 0);

  return (
    <div className="bg-main min-h-screen w-full">
      <Header pageName="Korean Drama" />

      <div className="space-y-8 px-3 pb-8 sm:px-4">
        <section
          className="flex flex-col gap-4 rounded-xl border border-default-200/70 bg-default-50/60 p-4 dark:border-white/10 dark:bg-default-50/10 sm:flex-row sm:items-center sm:p-5"
          aria-label="About Korean Drama"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/qw.png"
            alt=""
            aria-hidden
            className="mx-auto h-16 w-16 shrink-0 object-contain sm:mx-0"
          />
          <div className="min-w-0 flex-1 space-y-2 text-center sm:text-left">
            <p className="text-sm leading-relaxed text-default-600 dark:text-default-400">
              Romance, thrillers, workplace dramas, and more — curated Korean TV with
              IMDb genres shared across movies and shows.
            </p>
            <Link
              href="/kdrama/all"
              className="inline-flex text-sm font-medium text-success hover:underline"
            >
              Browse all K-Dramas
            </Link>
          </div>
        </section>

        {(loading || (data?.genres.length ?? 0) > 0) && (
          <section className="flex w-full flex-col gap-3" aria-label="Browse by genre">
            <Chip color="success" variant="flat" size="md" radius="sm">
              Browse by genre
            </Chip>
            {loading ? (
              <GenreTilesSkeleton />
            ) : (
              <Carousel opts={{ align: "start", dragFree: true }} className="w-full">
                <CarouselContent className="-ml-3">
                  {(data?.genres ?? []).map((genre, i) => (
                    <CarouselItem
                      key={genre.slug}
                      className="basis-[42%] pl-3 sm:basis-[30%] md:basis-1/4 lg:basis-1/5 xl:basis-1/6"
                    >
                      <GenreTile
                        genre={genre}
                        colorClass={GENRE_COLORS[i % GENRE_COLORS.length]}
                      />
                    </CarouselItem>
                  ))}
                </CarouselContent>
              </Carousel>
            )}
          </section>
        )}

        {loading ? (
          <div className="flex flex-col gap-8">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex flex-col gap-3">
                <div className="h-7 w-36 animate-pulse rounded-lg bg-default-200" />
                <CatalogRailSkeleton horizontal={horizontal} count={6} />
              </div>
            ))}
          </div>
        ) : hasContent ? (
          <div className="flex flex-col gap-10">
            <CatalogRail
              title="Popular"
              items={data?.popular ?? []}
              moreHref="/kdrama/all?sort_by=popularity"
              moreLabel="View all"
            />
            <CatalogRail
              title="Romance"
              items={data?.romance ?? []}
              moreHref="/kdrama/all?genre=romance&sort_by=popularity"
              moreLabel="More romance"
            />
            <CatalogRail
              title="Drama"
              items={data?.drama ?? []}
              moreHref="/kdrama/all?genre=drama&sort_by=popularity"
              moreLabel="More drama"
            />
          </div>
        ) : (
          <p className="py-12 text-center text-sm text-default-500">
            No Korean dramas in the catalog yet. Check back soon.
          </p>
        )}
      </div>
    </div>
  );
}
