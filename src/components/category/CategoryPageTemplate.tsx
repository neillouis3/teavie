"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@heroui/react";
import NewEpisodesRail from "@/components/category/NewEpisodesRail";
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
  bustInflightDayCache,
  categoryDiscoverCacheKey,
  fetchCategoryDiscover,
  peekCategoryDiscoverCache,
  preferencesCacheKey,
  type CategoryDiscoverPayload,
} from "@/lib/pageDataCache";
import { useUserData } from "@/contexts/userDataContext";
import { PREFERENCES_CHANGED_EVENT } from "@/lib/userPreferences";
import { useResumeFetchWhenVisible } from "@/hooks/useResumeFetchWhenVisible";
import { cn } from "@/lib/utils";

type CategoryPageTemplateProps = {
  slug: string;
};

export default function CategoryPageTemplate({ slug }: CategoryPageTemplateProps) {
  const category = getCatalogCategory(slug);
  const { preferences } = useUserData();
  const [data, setData] = useState<CategoryDiscoverPayload | null>(() =>
    category ? peekCategoryDiscoverCache(category.slug, preferences) : null
  );
  const [ready, setReady] = useState(() => data != null);
  const preferencesSig = useMemo(
    () => preferencesCacheKey(preferences),
    [preferences]
  );

  const loadDiscover = useCallback(() => {
    if (!category) return;
    void fetchCategoryDiscover(category.slug, preferences).then((payload) => {
      setData(payload);
      setReady(true);
    });
  }, [category, preferences]);

  const bustDiscoverInflight = useCallback(() => {
    if (!category) return;
    bustInflightDayCache(categoryDiscoverCacheKey(category.slug, preferences));
  }, [category, preferences]);

  useEffect(() => {
    if (category) {
      document.title = `${category.label} - Teavie`;
    }
  }, [category]);

  useEffect(() => {
    if (!category) return;

    let cancelled = false;
    const cached = peekCategoryDiscoverCache(category.slug, preferences);
    if (cached) {
      setData(cached);
      setReady(true);
    }

    void fetchCategoryDiscover(category.slug, preferences).then((payload) => {
      if (cancelled) return;
      setData(payload);
      setReady(true);
    });

    return () => {
      cancelled = true;
    };
  }, [category, preferencesSig, preferences]);

  useResumeFetchWhenVisible(!ready, loadDiscover, bustDiscoverInflight);

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
        <p className="py-12 pr-4 text-sm text-default-500">Category not found.</p>
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
        ) : null}
        {useExploreSpotlight ? (
          <div className={`${MOBILE_CONTENT_INSET_LEFT} pb-8`}>
            <CatalogRailSkeleton count={8} />
          </div>
        ) : null}
        <div className={`space-y-8 pb-8 ${MOBILE_CONTENT_INSET_LEFT}`}>
          <div className="h-14 animate-pulse rounded-xl bg-default-200 dark:bg-default-100/10" />
          <CatalogRailSkeleton count={8} />
          <CatalogRailSkeleton count={8} />
          <CatalogRailSkeleton count={8} />
        </div>
      </div>
    );
  }

  const categoryGenres = data.genres.filter((genre) => genre.count > 0);

  const hasContent =
    data.trending.length > 0 ||
    data.popular.length > 0 ||
    data.topRated.length > 0 ||
    data.newEpisodes.length > 0 ||
    categoryGenres.length > 0;

  const hasTrending = data.trending.length > 0;
  const hasNewEpisodes = data.newEpisodes.length > 0;

  return (
    <div className="bg-background min-h-screen w-full">
      {hasTrending && (
        <section
          className={cn(
            "relative z-0 w-full overflow-hidden rounded-tl-2xl",
            useExploreSpotlight && RAIL_AFTER_SPOTLIGHT
          )}
          aria-label="Spotlight"
        >
          <TrendingHero
            variant="spotlight"
            bleedUnderNav={useExploreSpotlight}
            showDots={false}
            trendingMovies={[]}
            trendingTv={data.trending}
            spotlightItems={data.trending}
            maxItems={16}
            rounded={false}
            flushLeft={false}
          />
        </section>
      )}

      {hasNewEpisodes ? (
        <div
          className={cn(
            MOBILE_CONTENT_INSET_LEFT,
            "mb-8",
            hasTrending ? "mt-0" : "mt-2"
          )}
        >
          <NewEpisodesRail items={data.newEpisodes} />
        </div>
      ) : null}

      <div className={`${RAIL_STACK_CLASS} pb-10 ${MOBILE_CONTENT_INSET_LEFT}`}>
        <section
          className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
          aria-label={`Browse all ${category.label}`}
        >
          <div className="min-w-0">
            <ExploreSectionTitle variant="explore">{category.label}</ExploreSectionTitle>
            <p className="mt-1 max-w-2xl text-sm text-default-500 dark:text-default-400">
              {category.browseAllCardText}
            </p>
          </div>
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

        {hasContent ? (
          <>
            <CatalogRail
              title="Popular"
              items={data.popular}
              titleVariant="explore"
              moreHref={category.browseAllHref}
            />

            <CatalogRail
              title="Top rated"
              items={data.topRated}
              titleVariant="explore"
              moreHref={category.browseAllHref}
            />

            {categoryGenres.length > 0 ? (
              <section className={RAIL_INNER_CLASS} aria-label="Browse by genre">
                <ExploreSectionTitle variant="explore">Browse by genre</ExploreSectionTitle>
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
            ) : null}
          </>
        ) : (
          <p className="py-12 text-center text-sm text-default-500">
            No {category.label.toLowerCase()} titles in the catalog yet. Check back soon.
          </p>
        )}
      </div>
    </div>
  );
}
