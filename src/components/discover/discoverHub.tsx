"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import Header from "@/components/ui/header";
import CatalogRail from "@/components/explore/catalogRail";
import SmallCardLoading from "@/components/ui/smallCardLoading";
import { Chip } from "@heroui/react";
import type { ContentItem } from "@/types/content";

export type TmdbDiscoverPayload = {
  trendingMovies: ContentItem[];
  trendingTv: ContentItem[];
  popularMovies: ContentItem[];
  popularTv: ContentItem[];
};

const SHORTCUTS = [
  { href: "/search", label: "Search" },
  { href: "/movies/all", label: "All movies" },
  { href: "/shows/all", label: "All TV" },
  { href: "/anime/all", label: "Anime" },
] as const;

const EMPTY: TmdbDiscoverPayload = {
  trendingMovies: [],
  trendingTv: [],
  popularMovies: [],
  popularTv: [],
};

function TmdbRailsSkeleton() {
  return (
    <div className="flex w-full flex-col gap-8">
      {Array.from({ length: 2 }).map((_, section) => (
        <div key={section} className="flex flex-col gap-3">
          <div className="h-7 w-40 animate-pulse rounded-lg bg-default-200" />
          <div className="grid w-full grid-cols-3 gap-2 sm:gap-4 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-6">
            {Array.from({ length: 6 }).map((__, i) => (
              <SmallCardLoading key={i} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function DiscoverHub() {
  const [data, setData] = useState<TmdbDiscoverPayload | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    document.title = "Discover - Teavie";
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch("/api/tmdb/discover")
      .then((res) => res.json())
      .then((json) => {
        if (cancelled) return;
        setData({
          trendingMovies: json.trendingMovies ?? [],
          trendingTv: json.trendingTv ?? [],
          popularMovies: json.popularMovies ?? [],
          popularTv: json.popularTv ?? [],
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

  const hasAny =
    data &&
    (data.trendingMovies.length > 0 ||
      data.trendingTv.length > 0 ||
      data.popularMovies.length > 0 ||
      data.popularTv.length > 0);

  return (
    <div className="bg-background flex w-full flex-col">
      <Header pageName="Discover" />

      <div className="mt-4 flex w-full flex-col gap-2 px-3 sm:px-4">
        <p className="text-[11px] font-medium uppercase tracking-wider text-default-500">
          Browse
        </p>
        <div className="flex flex-wrap gap-2">
          {SHORTCUTS.map((s) => (
            <Link
              key={s.href}
              href={s.href}
              className="rounded-full border border-default-200 bg-default-100/80 px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:border-success hover:text-success dark:bg-default-100/20"
            >
              {s.label}
            </Link>
          ))}
        </div>
      </div>

      {(loading || hasAny) && (
        <div className="mt-8 flex w-full flex-col gap-10 px-3 pb-8 sm:px-4">
          <div className="mb-1">
            <Chip color="success" size="md" radius="sm">
              Trending & popular (TMDB)
            </Chip>
            <p className="mt-1 text-xs text-default-500">
              From The Movie Database — same picks as empty Search.
            </p>
          </div>
          {loading ? (
            <TmdbRailsSkeleton />
          ) : data ? (
            <div className="flex flex-col gap-10">
              <CatalogRail
                title="Trending movies this week"
                items={data.trendingMovies}
                moreHref="/search"
                moreLabel="Search & more"
              />
              <CatalogRail
                title="Trending TV this week"
                items={data.trendingTv}
                moreHref="/search"
                moreLabel="Search & more"
              />
              <CatalogRail
                title="Popular movies"
                items={data.popularMovies}
                moreHref="/search"
                moreLabel="Search & more"
              />
              <CatalogRail
                title="Popular TV shows"
                items={data.popularTv}
                moreHref="/search"
                moreLabel="Search & more"
              />
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
