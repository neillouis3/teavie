"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@heroui/react";
import Header from "@/components/ui/header";
import LargeCard from "@/components/ui/largeCard";
import CatalogRail, { CatalogRailSkeleton } from "@/components/catalog/catalogRail";
import ExploreSectionTitle from "@/components/explore/exploreSectionTitle";
import TrendingHero from "@/components/catalog/trendingHero";
import SidebarBleedRail, {
  SIDEBAR_BLEED_CAROUSEL_OPTS,
  SidebarBleedStartSpacer,
  sidebarBleedViewportClass,
} from "@/components/ui/sidebarBleedRail";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
} from "@/components/ui/carousel";
import type { ContentItem } from "@/types/content";
import {
  GenreCatalogTile,
  genreTileColor,
} from "@/components/genre/genreTileShared";
import {
  categoryGenreBrowseHref,
  getCatalogCategory,
} from "@/lib/catalogCategories";
import { MOBILE_CONTENT_INSET_LEFT } from "@/lib/contentInset";
import {
  RAIL_AFTER_SPOTLIGHT,
  RAIL_CAROUSEL_ITEM_GENRE,
  RAIL_INNER_CLASS,
  RAIL_STACK_CLASS,
  RAIL_TRACK,
} from "@/lib/catalogGrid";
import {
  fetchCategoryDiscover,
  type CategoryDiscoverPayload,
} from "@/lib/pageDataCache";
import { useUserData } from "@/contexts/userDataContext";
import { PREFERENCES_CHANGED_EVENT } from "@/lib/userPreferences";
import { cn } from "@/lib/utils";

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
  const { preferences } = useUserData();
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
    void fetchCategoryDiscover(category.slug, preferences).then((payload) => {
      if (cancelled) return;
      setData(payload);
      setReady(true);
    });

    return () => {
      cancelled = true;
    };
  }, [category, preferences]);

  useEffect(() => {
    if (!category) return;
    const refresh = () => {
      void fetchCategoryDiscover(category.slug, preferences).then(setData);
    };
    window.addEventListener(PREFERENCES_CHANGED_EVENT, refresh);
    return () => window.removeEventListener(PREFERENCES_CHANGED_EVENT, refresh);
  }, [category, preferences]);

  if (!category) {
    return (
      <div className="bg-main min-h-screen w-full">
        <Header pageName="Category" />
        <p className="pr-4 py-12 text-sm text-default-500">Category not found.</p>
      </div>
    );
  }

  const useExploreSpotlight =
    category.slug === "anime" || category.slug === "kdrama";

  if (!ready || !data) {
    return (
      <div className="bg-background min-h-screen w-full">
        {useExploreSpotlight ? (
          <section
            className={`relative z-0 w-full overflow-hidden rounded-tl-2xl ${RAIL_AFTER_SPOTLIGHT}`}
            aria-hidden
          >
            <div className="min-h-[52vh] animate-pulse bg-default-200 sm:min-h-[62vh] lg:min-h-[80vh] dark:bg-default-100/10" />
          </section>
        ) : (
          <Header pageName={category.label} />
        )}
        <div className={`space-y-8 pb-8 ${MOBILE_CONTENT_INSET_LEFT}`}>
          <div className="h-24 animate-pulse rounded-xl bg-default-200 dark:bg-default-100/10" />
          <CatalogRailSkeleton count={8} />
          <CatalogRailSkeleton count={8} />
          <CatalogRailSkeleton count={8} />
        </div>
      </div>
    );
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
      {!useExploreSpotlight ? <Header pageName={category.label} /> : null}

      {hasTrending && (
        <section
          className={cn(
            useExploreSpotlight
              ? "relative z-0 w-full overflow-hidden rounded-tl-2xl"
              : `mb-4 mt-2 flex w-full flex-col ${TRENDING_SECTION_MIN_H}`,
            useExploreSpotlight && RAIL_AFTER_SPOTLIGHT
          )}
          aria-label={useExploreSpotlight ? "Spotlight" : "Trending"}
        >
          <TrendingHero
            variant={useExploreSpotlight ? "spotlight" : "carousel"}
            bleedUnderNav={useExploreSpotlight}
            showDots={!useExploreSpotlight}
            trendingMovies={[]}
            trendingTv={data.trending}
            spotlightItems={useExploreSpotlight ? data.trending : undefined}
            maxItems={16}
            rounded={!useExploreSpotlight}
            flushLeft={!useExploreSpotlight}
          />
        </section>
      )}

      <div className={`space-y-8 pb-8 ${MOBILE_CONTENT_INSET_LEFT}`}>
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
            <ExploreSectionTitle variant="explore">Featured</ExploreSectionTitle>
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
          <section className={RAIL_INNER_CLASS} aria-label="Browse by Genre">
            <SidebarBleedRail>
            <Carousel opts={SIDEBAR_BLEED_CAROUSEL_OPTS} className="w-full">
              <CarouselContent
                viewportClassName={sidebarBleedViewportClass()}
                className={RAIL_TRACK}
              >
                <SidebarBleedStartSpacer />
                {categoryGenres.map((genre, i) => (
                  <CarouselItem
                    key={genre.slug}
                    className={RAIL_CAROUSEL_ITEM_GENRE}
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
          <div className={RAIL_STACK_CLASS}>
            <CatalogRail title="Popular" items={data.popular} titleVariant="explore" />
            <CatalogRail title="Top rated" items={data.topRated} titleVariant="explore" />
            <CatalogRail title="New" items={data.new} titleVariant="explore" />
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
