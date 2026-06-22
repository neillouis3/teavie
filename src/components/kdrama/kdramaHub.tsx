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
import {
  GenreCatalogTile,
  genreTileColor,
  type CatalogGenreRow,
} from "@/components/genre/genreTileShared";

type KdramaDiscoverPayload = {
  popular: ContentItem[];
  romance: ContentItem[];
  drama: ContentItem[];
  genres: CatalogGenreRow[];
};

const EMPTY: KdramaDiscoverPayload = {
  popular: [],
  romance: [],
  drama: [],
  genres: [],
};

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
                      <GenreCatalogTile
                        genre={genre}
                        colorClass={genreTileColor(genre.name, i)}
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
              moreHref={genrePageHref("romance")}
              moreLabel="More romance"
            />
            <CatalogRail
              title="Drama"
              items={data?.drama ?? []}
              moreHref={genrePageHref("drama")}
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
