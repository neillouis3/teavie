"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@heroui/react";
import Header from "@/components/ui/header";
import PageSplash from "@/components/ui/pageSplash";
import LargeCard from "@/components/ui/largeCard";
import CatalogRail from "@/components/catalog/catalogRail";
import ExploreSectionTitle from "@/components/explore/exploreSectionTitle";
import TrendingHero from "@/components/catalog/trendingHero";
import SidebarBleedRail from "@/components/ui/sidebarBleedRail";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
} from "@/components/ui/carousel";
import type { ContentItem } from "@/types/content";
import {
  GenreCatalogTile,
  genreTileColor,
  type CatalogGenreRow,
} from "@/components/genre/genreTileShared";
import {
  categoryGenreBrowseHref,
  getCatalogCategory,
} from "@/lib/catalogCategories";
import {
  fetchCategoryDiscover,
  type CategoryDiscoverPayload,
} from "@/lib/pageDataCache";

/** Match Explore trending hero overlay; tuned for two-up featured row. */
const FEATURED_CARD_HEIGHT =
  "h-[min(38.5vh,364px)] sm:h-[min(43.4vh,406px)]";

const TRENDING_SECTION_MIN_H = "min-h-[52vh] sm:min-h-[62vh] lg:min-h-[80vh]";

function itemYear(item: ContentItem) {
  const raw = item.release_date || item.first_air_date || "";
  return raw.length >= 4 ? raw.slice(0, 4) : "—";
}

function featuredReleaseIso(item: ContentItem) {
  const raw = item.release_date ?? item.first_air_date ?? "";
  return raw.length >= 10 ? raw.slice(0, 10) : null;
}

function itemKey(item: ContentItem) {
  return `${item.type ?? "tv"}-${item.id}`;
}

type CategoryPageTemplateProps = {
  slug: string;
};

export default function CategoryPageTemplate({ slug }: CategoryPageTemplateProps) {
  const category = getCatalogCategory(slug);
  const [data, setData] = useState<CategoryDiscoverPayload | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (category) {
      document.title = `${category.label} - Teavie`;
    }
  }, [category]);

  useEffect(() => {
    if (!category) return;

    let cancelled = false;
    void fetchCategoryDiscover(category.slug).then((payload) => {
      if (cancelled) return;
      setData(payload);
      setReady(true);
    });

    return () => {
      cancelled = true;
    };
  }, [category]);

  if (!category) {
    return (
      <div className="bg-main min-h-screen w-full">
        <Header pageName="Category" />
        <p className="pr-4 py-12 text-sm text-default-500">Category not found.</p>
      </div>
    );
  }

  if (!ready || !data) {
    return <PageSplash ariaLabel={`Loading ${category.label}`} />;
  }

  const categoryGenres = data.genres.filter((genre) => genre.count > 0);

  const hasContent =
    data.featured.length > 0 ||
    data.trending.length > 0 ||
    data.popular.length > 0 ||
    data.topRated.length > 0 ||
    data.new.length > 0 ||
    data.genres.some((g) => g.count > 0);

  const hasTrending = data.trending.length > 0;
  const hasFeatured = data.featured.length > 0;

  return (
    <div className="bg-background min-h-screen w-full">
      <Header pageName={category.label} />

      {hasTrending && (
        <section
          className={`mb-4 mt-2 flex w-full flex-col ${TRENDING_SECTION_MIN_H}`}
          aria-label="Trending"
        >
          <TrendingHero
            trendingMovies={[]}
            trendingTv={data.trending}
            maxItems={16}
            rounded
            flushLeft
          />
        </section>
      )}

      <div className="space-y-8 pr-3 pb-8 sm:pr-4">
        <section
          className="flex flex-col gap-4 rounded-xl border border-default-200/70 bg-default-50/60 p-4 dark:border-white/10 dark:bg-default-50/10 sm:flex-row sm:items-center sm:justify-between sm:p-5"
          aria-label={`Browse all ${category.label}`}
        >
          <p className="text-sm text-default-600 dark:text-default-400">
            {category.browseAllCardText}
          </p>
          <Button
            as={Link}
            href={category.browseAllHref}
            color="success"
            variant="flat"
            size="sm"
            radius="full"
            className="shrink-0 font-medium"
          >
            {category.browseAllLabel}
          </Button>
        </section>

        {hasFeatured && (
          <section className="space-y-3" aria-label="Featured">
            <ExploreSectionTitle>Featured</ExploreSectionTitle>
            <div className="grid gap-3 sm:grid-cols-2">
              {data.featured.map((item) => {
                const title = item.title || item.name || "Untitled";
                return (
                  <div
                    key={itemKey(item)}
                    className={`${FEATURED_CARD_HEIGHT} overflow-hidden rounded-2xl`}
                  >
                    <LargeCard
                      hero
                      heroCompact
                      id={item.id}
                      title={title}
                      year={itemYear(item)}
                      releaseDate={featuredReleaseIso(item)}
                      runtimeSeconds={item.runtimeSeconds ?? undefined}
                      seasonAmount={item.season_amount ?? 0}
                      numberOfEpisodes={item.number_of_episodes ?? undefined}
                      type="tv"
                      posterPath={item.poster_path ?? ""}
                      backdropPath={item.backdrop_path ?? ""}
                      genres={item.genres ?? item.imdb_genres ?? []}
                      voteAverage={item.vote_average ?? null}
                      certification={item.certification ?? null}
                    />
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {categoryGenres.length > 0 && (
          <section className="flex w-full flex-col gap-3" aria-label="Browse by genre">
            <ExploreSectionTitle>Browse by genre</ExploreSectionTitle>
            <SidebarBleedRail>
            <Carousel opts={{ align: "start", dragFree: true }} className="w-full">
              <CarouselContent className="-ml-3">
                {categoryGenres.map((genre, i) => (
                  <CarouselItem
                    key={genre.slug}
                    className="basis-[42%] pl-3 sm:basis-[30%] md:basis-1/4 lg:basis-1/5 xl:basis-1/6"
                  >
                    <GenreCatalogTile
                      genre={genre}
                      colorClass={genreTileColor(genre.name, i)}
                      href={categoryGenreBrowseHref(category, genre.slug)}
                    />
                  </CarouselItem>
                ))}
              </CarouselContent>
            </Carousel>
            </SidebarBleedRail>
          </section>
        )}

        {hasContent ? (
          <div className="flex flex-col gap-10">
            <CatalogRail title="Popular" items={data.popular} />
            <CatalogRail title="Top rated" items={data.topRated} />
            <CatalogRail title="New" items={data.new} />
          </div>
        ) : (
          <p className="py-12 text-center text-sm text-default-500">
            No {category.label.toLowerCase()} titles in the catalog yet. Check back soon.
          </p>
        )}
      </div>
    </div>
  );
}
