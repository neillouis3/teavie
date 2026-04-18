import React from "react";
import Link from "next/link";
import Header from "./ui/header";
import UpcomingViewer from "./viewer/upcomingViewer";
import NewViewer from "./viewer/newViewer";
import UpdatedViewer from "./viewer/updatedViewer";

import UpcomingViewerLoading from "./viewer/skeleton/upcomingViewerLoading";
import NewViewerLoading from "./viewer/skeleton/newViewerLoading";
import UpdatedViewerLoading from "./viewer/skeleton/updatedViewerLoading";
import SmallCardLoading from "./ui/smallCardLoading";

import { Chip } from "@heroui/react";
import { ContentItem } from "@/types/content";
import CatalogRail from "@/components/explore/catalogRail";

export type TmdbDiscoverPayload = {
  trendingMovies: ContentItem[];
  trendingTv: ContentItem[];
  popularMovies: ContentItem[];
  popularTv: ContentItem[];
};

interface ExploreProps {
  newContentData: ContentItem[];
  updatedContentData: ContentItem[];
  upcomingContentData: ContentItem[];
  loading: boolean;
  tmdbDiscover: TmdbDiscoverPayload | null;
  tmdbDiscoverLoading: boolean;
}

const EXPLORE_SHORTCUTS = [
  { href: "/search", label: "Search" },
  { href: "/movies/all", label: "All movies" },
  { href: "/shows/all", label: "All TV" },
  { href: "/anime/all", label: "Anime" },
] as const;

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

export default function Explore({
  newContentData,
  updatedContentData,
  upcomingContentData,
  loading,
  tmdbDiscover,
  tmdbDiscoverLoading,
}: ExploreProps) {
  const hasAnyTmdbRail =
    tmdbDiscover &&
    (tmdbDiscover.trendingMovies.length > 0 ||
      tmdbDiscover.trendingTv.length > 0 ||
      tmdbDiscover.popularMovies.length > 0 ||
      tmdbDiscover.popularTv.length > 0);

  return (
    <div className="bg-background  w-full flex flex-col ">
      <Header pageName="Explore" />

      <div className="mt-4 flex w-full flex-col gap-2 px-3 sm:px-4">
        <p className="text-[11px] font-medium uppercase tracking-wider text-default-500">
          Browse
        </p>
        <div className="flex flex-wrap gap-2">
          {EXPLORE_SHORTCUTS.map((s) => (
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

      {(tmdbDiscoverLoading || hasAnyTmdbRail) && (
        <div className="mt-8 flex w-full flex-col gap-10 px-3 sm:px-4">
          <div className="mb-1">
            <Chip color="success" size="md" radius="sm">
              Trending & popular (TMDB)
            </Chip>
            <p className="mt-1 text-xs text-default-500">
              Updated from The Movie Database — same picks as empty Search.
            </p>
          </div>
          {tmdbDiscoverLoading ? (
            <TmdbRailsSkeleton />
          ) : tmdbDiscover ? (
            <div className="flex flex-col gap-10">
              <CatalogRail
                title="Trending movies this week"
                items={tmdbDiscover.trendingMovies}
                moreHref="/search"
                moreLabel="Search & more"
              />
              <CatalogRail
                title="Trending TV this week"
                items={tmdbDiscover.trendingTv}
                moreHref="/search"
                moreLabel="Search & more"
              />
              <CatalogRail
                title="Popular movies"
                items={tmdbDiscover.popularMovies}
                moreHref="/search"
                moreLabel="Search & more"
              />
              <CatalogRail
                title="Popular TV shows"
                items={tmdbDiscover.popularTv}
                moreHref="/search"
                moreLabel="Search & more"
              />
            </div>
          ) : null}
        </div>
      )}

      {/* New & Upcoming Section */}
      <div className="mt-6 mb-4 flex h-fit w-full flex-col">
        <div className="mb-4 px-3 sm:pl-4">
          <Chip color="success" size="md" radius="sm">
            New & Upcoming
          </Chip>
        </div>
        <div>
          {loading ? (
            <UpcomingViewerLoading />
          ) : (
            <UpcomingViewer upcomingContentData={upcomingContentData} />
          )}
        </div>
      </div>

      {/* New + Updated Section */}
      <div className="mb-8 mt-2 flex h-fit w-full flex-col gap-8 px-3 sm:px-4 lg:flex-row lg:gap-16 xl:gap-24">
        {/* New on SofaCouch */}
        <div className="flex-4 flex w-full flex-col">
          <div className="flex flex-row h-fit justify-between items-center">
            <Chip
              color="success"
              variant="flat"
              size="md"
              className="mb-4"
              radius="sm"
            >
              New on SofaCouch
            </Chip>
            <Link
              href="/movies/all"
              className="text-xs text-success underline underline-offset-2 hover:opacity-80"
            >
              View catalog
            </Link>
          </div>
          <div className="w-full">
            {loading ? (
              <NewViewerLoading />
            ) : (
              <NewViewer newContent={newContentData} />
            )}
          </div>
        </div>

        {/* Recently Updated */}
        <div className="flex-2 hidden h-fit flex-col md:block lg:pr-4">
          <Chip
            color="success"
            variant="flat"
            size="md"
            className="mb-4"
            radius="sm"
          >
            Recently Updated
          </Chip>
          <div className="w-full h-fit rounded-xl">
            {loading ? (
              <UpdatedViewerLoading />
            ) : (
              <UpdatedViewer updatedContent={updatedContentData} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
