"use client";

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react";
import CatalogRail from "@/components/catalog/catalogRail";
import CategoryBrowseBar from "@/components/category/CategoryBrowseBar";
import CategoryGenreRail from "@/components/category/CategoryGenreRail";
import NewEpisodesRail from "@/components/category/NewEpisodesRail";
import CategoryGenreRailSkeleton from "@/components/category/skeleton/categoryGenreRailSkeleton";
import CategoryRailSectionSkeleton from "@/components/category/skeleton/categoryRailSectionSkeleton";
import CategorySpotlightSkeleton from "@/components/category/skeleton/categorySpotlightSkeleton";
import TrendingHero from "@/components/catalog/trendingHero";
import {
  getCatalogCategory,
} from "@/lib/catalogCategories";
import {
  RAIL_AFTER_SPOTLIGHT,
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
  categoryDiscoverPartNeeds,
  EMPTY_CATEGORY,
  fetchCategoryDiscoverGenres,
  fetchCategoryDiscoverHero,
  fetchCategoryDiscoverNewEpisodes,
  fetchCategoryDiscoverTopRated,
  peekCategoryDiscoverInitial,
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

function syncReadyFlags(data: CategoryDiscoverPayload) {
  return {
    heroReady: hasCategoryHeroData(data),
    topRatedReady: data.topRated.length > 0,
    newEpisodesReady: data.newEpisodes.length > 0,
    genresReady: data.genres.some((genre) => (genre.count ?? 0) > 0),
  };
}

export default function CategoryPageTemplate({ slug }: CategoryPageTemplateProps) {
  const category = getCatalogCategory(slug);
  const { preferences } = useUserData();
  const [data, setData] = useState<CategoryDiscoverPayload>(() => {
    if (!category) return EMPTY_CATEGORY;
    return peekCategoryDiscoverInitial(category.slug, preferences);
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

  const loadDiscover = useCallback(() => {
    if (!category) return;

    const cached = peekCategoryDiscoverInitial(category.slug, preferences);
    const needs = categoryDiscoverPartNeeds(cached);

    if (!needs.hero && !needs.topRated && !needs.newEpisodes && !needs.genres) {
      setData(cached);
      const flags = syncReadyFlags(cached);
      setHeroReady(flags.heroReady);
      setTopRatedReady(flags.topRatedReady);
      setNewEpisodesReady(flags.newEpisodesReady);
      setGenresReady(flags.genresReady);
      return;
    }

    if (needs.hero) {
      void fetchCategoryDiscoverHero(category.slug, preferences).then((hero) => {
        setData((prev) => ({ ...prev, ...hero }));
        setHeroReady(true);
      });
    }

    if (needs.newEpisodes) {
      void fetchCategoryDiscoverNewEpisodes(category.slug, preferences).then((part) => {
        setData((prev) => ({ ...prev, ...part }));
        setNewEpisodesReady(true);
      });
    }

    if (needs.topRated) {
      void fetchCategoryDiscoverTopRated(category.slug, preferences).then((part) => {
        setData((prev) => ({ ...prev, ...part }));
        setTopRatedReady(true);
      });
    }

    if (needs.genres) {
      void fetchCategoryDiscoverGenres(category.slug, preferences).then((part) => {
        setData((prev) => ({ ...prev, ...part }));
        setGenresReady(true);
      });
    }
  }, [category, preferences]);

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

  useLayoutEffect(() => {
    if (!category) return;

    const cached = peekCategoryDiscoverInitial(category.slug, preferences);
    setData(cached);
    const flags = syncReadyFlags(cached);
    setHeroReady(flags.heroReady);
    setTopRatedReady(flags.topRatedReady);
    setNewEpisodesReady(flags.newEpisodesReady);
    setGenresReady(flags.genresReady);
  }, [category, preferencesSig, preferences]);

  useEffect(() => {
    if (!category) return;

    let cancelled = false;
    const cached = peekCategoryDiscoverInitial(category.slug, preferences);
    const needs = categoryDiscoverPartNeeds(cached);

    if (!needs.hero && !needs.topRated && !needs.newEpisodes && !needs.genres) {
      return;
    }

    const fetches: Promise<void>[] = [];

    if (needs.hero) {
      fetches.push(
        fetchCategoryDiscoverHero(category.slug, preferences).then((hero) => {
          if (cancelled) return;
          setData((prev) => ({ ...prev, ...hero }));
          setHeroReady(true);
        })
      );
    }

    if (needs.newEpisodes) {
      fetches.push(
        fetchCategoryDiscoverNewEpisodes(category.slug, preferences).then((part) => {
          if (cancelled) return;
          setData((prev) => ({ ...prev, ...part }));
          setNewEpisodesReady(true);
        })
      );
    }

    if (needs.topRated) {
      fetches.push(
        fetchCategoryDiscoverTopRated(category.slug, preferences).then((part) => {
          if (cancelled) return;
          setData((prev) => ({ ...prev, ...part }));
          setTopRatedReady(true);
        })
      );
    }

    if (needs.genres) {
      fetches.push(
        fetchCategoryDiscoverGenres(category.slug, preferences).then((part) => {
          if (cancelled) return;
          setData((prev) => ({ ...prev, ...part }));
          setGenresReady(true);
        })
      );
    }

    void Promise.all(fetches);

    return () => {
      cancelled = true;
    };
  }, [category, preferencesSig, preferences]);

  const discoverPending = useMemo(
    () =>
      !heroReady ||
      !topRatedReady ||
      !newEpisodesReady ||
      !genresReady,
    [heroReady, topRatedReady, newEpisodesReady, genresReady]
  );

  useResumeFetchWhenVisible(discoverPending, loadDiscover, bustDiscoverInflight);

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
      {hasTrending ? (
        <section
          className={cn(
            "relative z-0 w-full overflow-hidden rounded-tl-2xl",
            useExploreSpotlight && "-mt-14",
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
      ) : !heroReady && useExploreSpotlight ? (
        <CategorySpotlightSkeleton />
      ) : null}

      {!hasTrending && heroReady && useExploreSpotlight ? (
        <div className="mb-8 mt-2 w-full px-4 lg:px-24">
          <CategoryBrowseBar category={category} />
        </div>
      ) : null}

      {!newEpisodesReady && !hasNewEpisodes ? (
        <div
          className={cn(
            "mb-8 w-full",
            MOBILE_CONTENT_INSET_LEFT,
            (hasTrending || (!heroReady && useExploreSpotlight)) && "mt-2"
          )}
        >
          <CategoryRailSectionSkeleton titleWidth="w-32" />
        </div>
      ) : hasNewEpisodes ? (
        <div
          className={cn(
            "mb-8 w-full",
            MOBILE_CONTENT_INSET_LEFT,
            (hasTrending || (!heroReady && useExploreSpotlight)) && "mt-2"
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
            ) : !heroReady ? (
              <CategoryRailSectionSkeleton titleWidth="w-24" />
            ) : null}

            {data.topRated.length > 0 ? (
              <CatalogRail
                title="Top rated"
                items={data.topRated}
                titleVariant="explore"
              />
            ) : !topRatedReady ? (
              <CategoryRailSectionSkeleton titleWidth="w-28" />
            ) : null}
          </>
        ) : heroReady && !railsLoading ? (
          <p className="py-12 text-center text-sm text-default-500">
            No {category.label.toLowerCase()} titles in the catalog yet. Check back soon.
          </p>
        ) : (
          <>
            <CategoryRailSectionSkeleton titleWidth="w-24" />
            <CategoryRailSectionSkeleton titleWidth="w-28" />
          </>
        )}
      </div>

      {!genresReady && categoryGenres.length === 0 ? (
        <div className={cn("pb-10 pt-8", MOBILE_CONTENT_INSET_LEFT)}>
          <CategoryGenreRailSkeleton />
        </div>
      ) : categoryGenres.length > 0 ? (
        <div className={cn("pb-10 pt-8", MOBILE_CONTENT_INSET_LEFT)}>
          <CategoryGenreRail category={category} genres={categoryGenres} />
        </div>
      ) : null}
    </div>
  );
}
