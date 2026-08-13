"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import NewEpisodesRail from "@/components/category/NewEpisodesRail";
import CategoryBrowseBar from "@/components/category/CategoryBrowseBar";
import CategoryGenreRail from "@/components/category/CategoryGenreRail";
import CatalogRail, { CatalogRailSkeleton } from "@/components/catalog/catalogRail";
import TrendingHero from "@/components/catalog/trendingHero";
import {
  getCatalogCategory,
} from "@/lib/catalogCategories";
import { MOBILE_CONTENT_INSET_LEFT } from "@/lib/contentInset";
import {
  RAIL_AFTER_SPOTLIGHT,
  RAIL_STACK_CLASS,
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
            <div className="absolute inset-x-0 bottom-4 h-24 animate-pulse rounded-xl bg-default-100/20 px-4 lg:bottom-6 lg:px-24" />
          </section>
        ) : null}
        {useExploreSpotlight ? (
          <div className={`${MOBILE_CONTENT_INSET_LEFT} pb-8`}>
            <div className="mb-8 h-[7.5rem] animate-pulse rounded-2xl bg-default-200 dark:bg-default-100/10" />
            <CatalogRailSkeleton count={8} />
          </div>
        ) : null}
        <div className={`space-y-8 pb-8 ${MOBILE_CONTENT_INSET_LEFT}`}>
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
            showSpotlightSelector={!useExploreSpotlight}
            trendingMovies={[]}
            trendingTv={data.trending}
            spotlightItems={data.trending}
            maxItems={16}
            rounded={false}
            flushLeft={false}
          />
          {useExploreSpotlight && categoryGenres.length > 0 ? (
            <CategoryGenreRail
              category={category}
              genres={categoryGenres}
              overlay
            />
          ) : null}
        </section>
      )}

      {!hasTrending && useExploreSpotlight && categoryGenres.length > 0 ? (
        <div className={cn(MOBILE_CONTENT_INSET_LEFT, "mb-8 mt-2")}>
          <CategoryGenreRail category={category} genres={categoryGenres} />
        </div>
      ) : null}

      <div
        className={cn(
          MOBILE_CONTENT_INSET_LEFT,
          hasTrending ? "-mt-2" : "mt-2",
          hasNewEpisodes ? "mb-8" : RAIL_AFTER_SPOTLIGHT
        )}
      >
        <CategoryBrowseBar category={category} />
      </div>

      {hasNewEpisodes ? (
        <div className={cn(MOBILE_CONTENT_INSET_LEFT, "mb-8")}>
          <NewEpisodesRail items={data.newEpisodes} />
        </div>
      ) : null}

      <div className={`${RAIL_STACK_CLASS} pb-10 ${MOBILE_CONTENT_INSET_LEFT}`}>
        {hasContent ? (
          <>
            <CatalogRail
              title="Popular"
              items={data.popular}
              titleVariant="explore"
            />

            <CatalogRail
              title="Top rated"
              items={data.topRated}
              titleVariant="explore"
            />
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
