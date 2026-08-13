'use client';

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import CatalogRail, { CatalogRailSkeleton } from '@/components/catalog/catalogRail';
import TrendingHero, { SPOTLIGHT_SKELETON_H } from '@/components/catalog/trendingHero';
import ExploreSectionTitle from '@/components/explore/exploreSectionTitle';
import {
  bustInflightDayCache,
  fetchGenrePageShell,
  fetchGenrePageTopRated,
  genrePageCacheKey,
  genrePagePartNeeds,
  genrePageShellCacheKey,
  genrePageTopRatedCacheKey,
  peekGenrePageInitial,
  preferencesCacheKey,
  type GenrePagePayload,
} from '@/lib/pageDataCache';
import {
  RAIL_AFTER_SPOTLIGHT,
  RAIL_INNER_CLASS,
  RAIL_STACK_CLASS,
} from '@/lib/catalogGrid';
import { CatalogRailShell } from '@/components/ui/sidebarBleedRail';
import {
  MOBILE_CONTENT_INSET_LEFT,
} from '@/lib/contentInset';
import { useUserData } from '@/contexts/userDataContext';
import { PREFERENCES_CHANGED_EVENT } from '@/lib/userPreferences';
import { useResumeFetchWhenVisible } from '@/hooks/useResumeFetchWhenVisible';
import { cn } from '@/lib/utils';
import type { UserPreferences } from '@/types/user';

export type GenrePageType = 'all' | 'movie' | 'tv';
export type GenrePageSort = 'popular' | 'top_rated';

const TYPE_OPTIONS: { key: GenrePageType; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'movie', label: 'Movies' },
  { key: 'tv', label: 'TV' },
];

const RAIL_SECTIONS: { sort: GenrePageSort; title: string }[] = [
  { sort: 'popular', title: 'Popular' },
  { sort: 'top_rated', title: 'Top rated' },
];

const RAIL_LIMIT = 24;
const SPOTLIGHT_MAX_ITEMS = 16;
const GENRE_TAB_TYPES: GenrePageType[] = ["all", "movie", "tv"];

type GenreTabState = {
  payload: GenrePagePayload;
  shellReady: boolean;
  topRatedReady: boolean;
};

function genreTabCacheKey(
  slug: string,
  tabType: GenrePageType,
  preferencesSig: string
): string {
  return `${slug}:${tabType}:${preferencesSig}`;
}

function spotlightItemsFromPayload(payload: GenrePagePayload) {
  return payload.featured.length > 0
    ? payload.featured
    : payload.rails.popular.slice(0, SPOTLIGHT_MAX_ITEMS);
}

function readGenreTabState(
  slug: string,
  tabType: GenrePageType,
  preferences: UserPreferences | null
): GenreTabState {
  const payload = peekGenrePageInitial(slug, tabType, preferences);
  return { payload, ...syncGenreReadyFlags(payload) };
}

function mergeGenreShell(
  prev: GenrePagePayload,
  shell: Pick<GenrePagePayload, "featured" | "total" | "rails">
): GenrePagePayload {
  return {
    ...prev,
    featured: shell.featured,
    total: shell.total,
    rails: {
      ...prev.rails,
      popular: shell.rails.popular,
    },
  };
}

function mergeGenreTopRated(
  prev: GenrePagePayload,
  part: Pick<GenrePagePayload, "rails">
): GenrePagePayload {
  return {
    ...prev,
    rails: {
      ...prev.rails,
      top_rated: part.rails.top_rated,
    },
  };
}

function syncGenreReadyFlags(data: GenrePagePayload) {
  const needs = genrePagePartNeeds(data);
  return {
    shellReady: !needs.shell,
    topRatedReady: !needs.topRated,
  };
}

function GenreTypeFilter({
  type,
  onSelect,
  onPrefetch,
  overlay = false,
}: {
  type: GenrePageType;
  onSelect: (next: GenrePageType) => void;
  onPrefetch: (next: GenrePageType) => void;
  overlay?: boolean;
}) {
  const nav = (
    <nav
      aria-label="Content type"
      className="flex items-center gap-5"
    >
      {TYPE_OPTIONS.map((opt) => {
        const active = type === opt.key;
        return (
          <button
            key={opt.key}
            type="button"
            onClick={() => onSelect(opt.key)}
            onMouseEnter={() => onPrefetch(opt.key)}
            onFocus={() => onPrefetch(opt.key)}
            className={cn(
              'relative pb-2 text-sm transition-colors',
              overlay
                ? active
                  ? 'font-medium text-white after:absolute after:inset-x-0 after:bottom-0 after:h-px after:bg-white'
                  : 'text-white/70 hover:text-white'
                : active
                  ? 'font-medium text-foreground after:absolute after:inset-x-0 after:bottom-0 after:h-px after:bg-foreground'
                  : 'text-default-500 hover:text-foreground'
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </nav>
  );

  if (overlay) {
    return (
      <div
        className="pointer-events-none absolute inset-x-0 bottom-4 z-20 flex justify-start px-4 lg:bottom-6 lg:px-24"
      >
        <div className="pointer-events-auto">{nav}</div>
      </div>
    );
  }

  return nav;
}

type GenrePageTemplateProps = {
  slug: string;
  genreLabel: string;
};

export default function GenrePageTemplate({ slug, genreLabel }: GenrePageTemplateProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { preferences } = useUserData();
  const typeCacheRef = useRef<Map<string, GenreTabState>>(new Map());
  const activeTypeRef = useRef<GenrePageType>("all");

  const rawType = searchParams.get('type') || 'all';
  const type: GenrePageType =
    rawType === 'movie' || rawType === 'tv' ? rawType : 'all';
  activeTypeRef.current = type;

  const initialTab = readGenreTabState(slug, type, preferences);
  const [payload, setPayload] = useState<GenrePagePayload>(() => initialTab.payload);
  const [shellReady, setShellReady] = useState(initialTab.shellReady);
  const [topRatedReady, setTopRatedReady] = useState(initialTab.topRatedReady);
  const [heroSpotlightItems, setHeroSpotlightItems] = useState(() =>
    spotlightItemsFromPayload(initialTab.payload)
  );
  const preferencesSig = useMemo(
    () => preferencesCacheKey(preferences),
    [preferences]
  );

  const readCachedTab = useCallback(
    (tabType: GenrePageType): GenreTabState => {
      const key = genreTabCacheKey(slug, tabType, preferencesSig);
      return typeCacheRef.current.get(key) ?? readGenreTabState(slug, tabType, preferences);
    },
    [slug, preferences, preferencesSig]
  );

  const writeCachedTab = useCallback(
    (tabType: GenrePageType, state: GenreTabState) => {
      typeCacheRef.current.set(
        genreTabCacheKey(slug, tabType, preferencesSig),
        state
      );
    },
    [slug, preferencesSig]
  );

  const applyTabState = useCallback((tabType: GenrePageType, state: GenreTabState) => {
    writeCachedTab(tabType, state);
    if (activeTypeRef.current !== tabType) return;
    setPayload(state.payload);
    setShellReady(state.shellReady);
    setTopRatedReady(state.topRatedReady);
    const spotlight = spotlightItemsFromPayload(state.payload);
    if (spotlight.length > 0) {
      setHeroSpotlightItems(spotlight);
    }
  }, [writeCachedTab]);

  const ensureTabLoaded = useCallback(
    (tabType: GenrePageType) => {
      const cached = readCachedTab(tabType);
      const needs = genrePagePartNeeds(cached.payload);

      if (!needs.shell && !needs.topRated) {
        applyTabState(tabType, cached);
        return;
      }

      if (needs.shell) {
        void fetchGenrePageShell(slug, tabType, preferences).then((shell) => {
          const base = readCachedTab(tabType);
          const next: GenreTabState = {
            payload: mergeGenreShell(base.payload, shell),
            shellReady: true,
            topRatedReady: base.topRatedReady,
          };
          applyTabState(tabType, next);
        });
      }

      if (needs.topRated) {
        void fetchGenrePageTopRated(slug, tabType, preferences).then((part) => {
          const base = readCachedTab(tabType);
          const next: GenreTabState = {
            payload: mergeGenreTopRated(base.payload, part),
            shellReady: base.shellReady,
            topRatedReady: true,
          };
          applyTabState(tabType, next);
        });
      }
    },
    [applyTabState, preferences, readCachedTab, slug]
  );

  const loadGenrePage = useCallback(() => {
    ensureTabLoaded(type);
  }, [ensureTabLoaded, type]);

  const bustGenreInflight = useCallback(() => {
    bustInflightDayCache(genrePageCacheKey(slug, type, preferences));
    bustInflightDayCache(genrePageShellCacheKey(slug, type, preferences));
    bustInflightDayCache(genrePageTopRatedCacheKey(slug, type, preferences));
  }, [slug, type, preferences]);

  const prefetchTab = useCallback(
    (tabType: GenrePageType) => {
      const cached = readCachedTab(tabType);
      if (!genrePagePartNeeds(cached.payload).shell) return;

      void fetchGenrePageShell(slug, tabType, preferences).then((shell) => {
        const base = readCachedTab(tabType);
        applyTabState(tabType, {
          payload: mergeGenreShell(base.payload, shell),
          shellReady: true,
          topRatedReady: base.topRatedReady,
        });
      });
    },
    [applyTabState, preferences, readCachedTab, slug]
  );

  useEffect(() => {
    document.title = `${genreLabel} - Teavie`;
  }, [genreLabel]);

  useLayoutEffect(() => {
    typeCacheRef.current.clear();
  }, [slug, preferencesSig]);

  useLayoutEffect(() => {
    applyTabState(type, readCachedTab(type));
  }, [type, slug, preferencesSig, applyTabState, readCachedTab]);

  useEffect(() => {
    ensureTabLoaded(type);
  }, [slug, type, preferencesSig, ensureTabLoaded]);

  useEffect(() => {
    for (const tabType of GENRE_TAB_TYPES) {
      prefetchTab(tabType);
    }
  }, [slug, preferencesSig, prefetchTab]);

  const discoverPending = !shellReady || !topRatedReady;
  useResumeFetchWhenVisible(discoverPending, loadGenrePage, bustGenreInflight);

  useEffect(() => {
    const refresh = () => {
      loadGenrePage();
    };
    window.addEventListener(PREFERENCES_CHANGED_EVENT, refresh);
    return () => window.removeEventListener(PREFERENCES_CHANGED_EVENT, refresh);
  }, [loadGenrePage]);

  const mergeParams = useCallback(
    (patch: Record<string, string | null | undefined>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [k, v] of Object.entries(patch)) {
        if (!v || (k === 'type' && v === 'all')) {
          params.delete(k);
        } else {
          params.set(k, String(v));
        }
      }
      params.delete('sort');
      params.delete('page');
      router.push(`${pathname}?${params.toString()}`);
    },
    [pathname, router, searchParams]
  );

  const onTypeSelect = useCallback(
    (next: GenrePageType) => {
      if (next === type) return;
      activeTypeRef.current = next;
      applyTabState(next, readCachedTab(next));
      prefetchTab(next);
      mergeParams({ type: next });
    },
    [applyTabState, mergeParams, prefetchTab, readCachedTab, type]
  );

  const { rails } = payload;
  const hasSpotlight = heroSpotlightItems.length > 0;
  const showHeroSkeleton = !hasSpotlight && !shellReady;
  const hasAnyRail = rails.popular.length > 0 || rails.top_rated.length > 0;
  const pageSettled = shellReady && topRatedReady;
  const showHeroChrome = hasSpotlight || showHeroSkeleton;
  const typeFilter = (
    <GenreTypeFilter
      type={type}
      onSelect={onTypeSelect}
      onPrefetch={prefetchTab}
      overlay={showHeroChrome}
    />
  );

  return (
    <div className="bg-background min-h-screen w-full">
      {hasSpotlight ? (
        <section
          className={cn(
            'relative z-0 -mt-14 w-full overflow-hidden rounded-tl-2xl',
            RAIL_AFTER_SPOTLIGHT
          )}
          aria-label="Spotlight"
        >
          <TrendingHero
            variant="spotlight"
            bleedUnderNav
            showDots={false}
            showSpotlightSelector={false}
            trendingMovies={[]}
            trendingTv={[]}
            spotlightItems={heroSpotlightItems}
            maxItems={SPOTLIGHT_MAX_ITEMS}
            rounded={false}
            flushLeft={false}
          />
          {typeFilter}
        </section>
      ) : showHeroSkeleton ? (
        <section
          className={cn(
            'relative z-0 -mt-14 w-full overflow-hidden rounded-tl-2xl',
            RAIL_AFTER_SPOTLIGHT
          )}
          aria-hidden
        >
          <div
            className={cn(
              'animate-pulse bg-default-200 dark:bg-default-100/10',
              SPOTLIGHT_SKELETON_H
            )}
          />
          {typeFilter}
        </section>
      ) : null}

      <div
        className={cn(
          RAIL_STACK_CLASS,
          MOBILE_CONTENT_INSET_LEFT,
          'w-full pb-10',
          (hasSpotlight || showHeroSkeleton) ? 'mt-0' : 'mt-2'
        )}
      >
        {!showHeroChrome ? typeFilter : null}

        {RAIL_SECTIONS.map(({ sort, title }) => {
          const items = rails[sort];
          const ready = sort === 'popular' ? shellReady : topRatedReady;

          if (items.length > 0) {
            return (
              <CatalogRail
                key={sort}
                title={title}
                items={items}
                maxItems={RAIL_LIMIT}
                titleVariant="explore"
                hideTitleIcon
              />
            );
          }

          if (!ready) {
            return (
              <div key={sort} className={RAIL_INNER_CLASS}>
                <ExploreSectionTitle variant="explore" hideIcon>
                  {title}
                </ExploreSectionTitle>
                <CatalogRailShell>
                  <CatalogRailSkeleton count={8} />
                </CatalogRailShell>
              </div>
            );
          }

          return null;
        })}

        {!hasAnyRail && !hasSpotlight && pageSettled ? (
          <p className="py-16 text-sm text-default-500">
            No titles found for {genreLabel}. Try another filter.
          </p>
        ) : null}
      </div>
    </div>
  );
}
