"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import CatalogRail, { CatalogRailSkeleton } from "@/components/catalog/catalogRail";
import CategoryBrowseBar from "@/components/category/CategoryBrowseBar";
import CategoryGenreRail from "@/components/category/CategoryGenreRail";
import NewEpisodesRail from "@/components/category/NewEpisodesRail";
import TrendingHero from "@/components/catalog/trendingHero";
import {
  getCatalogCategory,
} from "@/lib/catalogCategories";
import {
  RAIL_AFTER_SPOTLIGHT,
  RAIL_INNER_CLASS,
  RAIL_STACK_CLASS,
} from "@/lib/catalogGrid";
import { MOBILE_CONTENT_INSET_LEFT } from "@/lib/contentInset";
import {
  bustInflightDayCache,
  categoryDiscoverCacheKey,
  categoryDiscoverGenresCacheKey,
  categoryDiscoverHeroCacheKey,
  categoryDiscoverNewEpisodesCacheKey,
  categoryDiscoverTopRatedCacheKey,
  EMPTY_CATEGORY,
  fetchCategoryDiscoverGenres,
  fetchCategoryDiscoverHero,
  fetchCategoryDiscoverNewEpisodes,
  fetchCategoryDiscoverTopRated,
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

function hasCategoryHeroData(data: CategoryDiscoverPayload | null | undefined): boolean {
  return Boolean(data && (data.trending.length > 0 || data.popular.length > 0));
}

export default function CategoryPageTemplate({ slug }: CategoryPageTemplateProps) {
  const category = getCatalogCategory(slug);
  const { preferences } = useUserData();
  const [data, setData] = useState<CategoryDiscoverPayload>(() => {
    if (!category) return EMPTY_CATEGORY;
    return peekCategoryDiscoverCache(category.slug, preferences) ?? EMPTY_CATEGORY;
  });
  const [heroReady, setHeroReady] = useState(() => hasCategoryHeroData(data));
  const [topRatedReady, setTopRatedReady] = useState(() => data.topRated.length > 0);
  const [newEpisodesReady, setNewEpisodesReady] = useState(() => data.newEpisodes.length > 0);
  const [genresReady, setGenresReady] = useState(() =>
    data.genres.some((genre) => (genre.count ?? 0) > 0)
  );
  const preferencesSig = useMemo(
    () => preferencesCacheKey(preferences),
    [preferences]
  );

  const loadHero = useCallback(() => {
    if (!category) return;
    void fetchCategoryDiscoverHero(category.slug, preferences).then((hero) => {
      setData((prev) => ({ ...prev, ...hero }));
      setHeroReady(true);
    });
  }, [category, preferences]);

  const loadRails = useCallback(() => {
    if (!category) return;

    void fetchCategoryDiscoverNewEpisodes(category.slug, preferences).then((part) => {
      setData((prev) => ({ ...prev, ...part }));
      setNewEpisodesReady(true);
    });

    void fetchCategoryDiscoverTopRated(category.slug, preferences).then((part) => {
      setData((prev) => ({ ...prev, ...part }));
      setTopRatedReady(true);
    });

    void fetchCategoryDiscoverGenres(category.slug, preferences).then((part) => {
      setData((prev) => ({ ...prev, ...part }));
      setGenresReady(true);
    });
  }, [category, preferences]);

  const loadDiscover = useCallback(() => {
    loadHero();
    loadRails();
  }, [loadHero, loadRails]);

  const bustDiscoverInflight = useCallback(() => {
    if (!category) return;
    bustInflightDayCache(categoryDiscoverCacheKey(category.slug, preferences));
    bustInflightDayCache(categoryDiscoverHeroCacheKey(category.slug, preferences));
    bustInflightDayCache(categoryDiscoverTopRatedCacheKey(category.slug, preferences));
    bustInflightDayCache(categoryDiscoverNewEpisodesCacheKey(category.slug, preferences));
    bustInflightDayCache(categoryDiscoverGenresCacheKey(category.slug, preferences));
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
      setHeroReady(hasCategoryHeroData(cached));
      setTopRatedReady(cached.topRated.length > 0);
      setNewEpisodesReady(cached.newEpisodes.length > 0);
      setGenresReady(cached.genres.some((genre) => (genre.count ?? 0) > 0));
    } else {
      setTopRatedReady(false);
      setNewEpisodesReady(false);
      setGenresReady(false);
    }

    void fetchCategoryDiscoverHero(category.slug, preferences).then((hero) => {
      if (cancelled) return;
      setData((prev) => ({ ...prev, ...hero }));
      setHeroReady(true);
    });

    void fetchCategoryDiscoverNewEpisodes(category.slug, preferences).then((part) => {
      if (cancelled) return;
      setData((prev) => ({ ...prev, ...part }));
      setNewEpisodesReady(true);
    });

    void fetchCategoryDiscoverTopRated(category.slug, preferences).then((part) => {
      if (cancelled) return;
      setData((prev) => ({ ...prev, ...part }));
      setTopRatedReady(true);
    });

    void fetchCategoryDiscoverGenres(category.slug, preferences).then((part) => {
      if (cancelled) return;
      setData((prev) => ({ ...prev, ...part }));
      setGenresReady(true);
    });

    return () => {
      cancelled = true;
    };
  }, [category, preferencesSig, preferences]);

  useResumeFetchWhenVisible(!heroReady, loadDiscover, bustDiscoverInflight);

  useEffect(() => {
    if (!category) return;
    const refresh = () => {
      loadDiscover();
    };
    window.addEventListener(PREFERENCES_CHANGED_EVENT, refresh);
    return () => window.removeEventListener(PREFERENCES_CHANGED_EVENT, refresh);
  }, [category, loadDiscover]);

  if (!category) {
    return (
      <div className="bg-main min-h-screen w-full">
        <p className="py-12 pr-4 text-sm text-default-500">Category not found.</p>
      </div>
    );
  }

  const useExploreSpotlight =
    category.slug === "anime" || category.slug === "kdrama";

  if (!heroReady) {
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
          <div className={cn("w-full pb-8", MOBILE_CONTENT_INSET_LEFT)}>
            <div className={`${RAIL_INNER_CLASS} mb-8`}>
              <div className="h-5 w-32 animate-pulse rounded bg-default-200 dark:bg-default-100/10" />
              <CatalogRailSkeleton count={8} />
            </div>
            <CatalogRailSkeleton count={8} />
          </div>
        ) : null}
        <div className={cn("space-y-8 pb-8 w-full", MOBILE_CONTENT_INSET_LEFT)}>
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
  const railsLoading = !topRatedReady || !newEpisodesReady;

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
          {useExploreSpotlight ? (
            <CategoryBrowseBar category={category} overlay />
          ) : null}
        </section>
      )}

      {!hasTrending && useExploreSpotlight ? (
        <div className="mb-8 mt-2 w-full px-4 lg:px-24">
          <CategoryBrowseBar category={category} />
        </div>
      ) : null}

      {!newEpisodesReady && !hasNewEpisodes ? (
        <div
          className={cn(
            "mb-8 w-full",
            MOBILE_CONTENT_INSET_LEFT,
            hasTrending && "mt-2"
          )}
        >
          <div className={`${RAIL_INNER_CLASS} mb-8`}>
            <div className="h-5 w-40 animate-pulse rounded bg-default-200 dark:bg-default-100/10" />
            <CatalogRailSkeleton count={8} />
          </div>
        </div>
      ) : hasNewEpisodes ? (
        <div
          className={cn(
            "mb-8 w-full",
            MOBILE_CONTENT_INSET_LEFT,
            hasTrending && "mt-2"
          )}
        >
          <NewEpisodesRail items={data.newEpisodes} />
        </div>
      ) : null}

      <div
        className={cn(
          RAIL_STACK_CLASS,
          MOBILE_CONTENT_INSET_LEFT,
          "w-full",
          categoryGenres.length > 0 ? "pb-0" : "pb-10"
        )}
      >
        {hasContent || railsLoading ? (
          <>
            {data.popular.length > 0 ? (
              <CatalogRail
                title="Popular"
                items={data.popular}
                titleVariant="explore"
              />
            ) : null}

            {data.topRated.length > 0 ? (
              <CatalogRail
                title="Top rated"
                items={data.topRated}
                titleVariant="explore"
              />
            ) : !topRatedReady ? (
              <CatalogRailSkeleton count={8} />
            ) : null}
          </>
        ) : (
          <p className="py-12 text-center text-sm text-default-500">
            No {category.label.toLowerCase()} titles in the catalog yet. Check back soon.
          </p>
        )}
      </div>

      {!genresReady && categoryGenres.length === 0 ? (
        <div className={cn("pb-10 pt-8", MOBILE_CONTENT_INSET_LEFT)}>
          <div className="h-5 w-28 animate-pulse rounded bg-default-200 dark:bg-default-100/10" />
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {Array.from({ length: 6 }).map((_, index) => (
              <div
                key={index}
                className="aspect-[2/3] animate-pulse rounded-lg bg-default-200 dark:bg-default-100/10"
              />
            ))}
          </div>
        </div>
      ) : categoryGenres.length > 0 ? (
        <div className={cn("pb-10 pt-8", MOBILE_CONTENT_INSET_LEFT)}>
          <CategoryGenreRail category={category} genres={categoryGenres} />
        </div>
      ) : null}
    </div>
  );
}
