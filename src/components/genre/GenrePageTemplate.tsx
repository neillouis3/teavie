'use client';

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import CatalogRail, { CatalogRailSkeleton } from '@/components/catalog/catalogRail';
import TrendingHero, { SPOTLIGHT_SKELETON_H } from '@/components/catalog/trendingHero';
import ExploreSectionTitle from '@/components/explore/exploreSectionTitle';
import {
  bustInflightDayCache,
  fetchGenrePageNew,
  fetchGenrePageShell,
  fetchGenrePageTopRated,
  genrePageCacheKey,
  genrePageNewCacheKey,
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

export type GenrePageType = 'all' | 'movie' | 'tv';
export type GenrePageSort = 'popular' | 'top_rated' | 'new';

const TYPE_OPTIONS: { key: GenrePageType; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'movie', label: 'Movies' },
  { key: 'tv', label: 'TV' },
];

const RAIL_SECTIONS: { sort: GenrePageSort; title: string }[] = [
  { sort: 'popular', title: 'Popular' },
  { sort: 'top_rated', title: 'Top rated' },
  { sort: 'new', title: 'New' },
];

const RAIL_LIMIT = 24;
const SPOTLIGHT_MAX_ITEMS = 16;

function syncGenreReadyFlags(data: GenrePagePayload) {
  const needs = genrePagePartNeeds(data);
  return {
    shellReady: !needs.shell,
    topRatedReady: !needs.topRated,
    newReady: !needs.newRail,
  };
}

function GenreTypeFilter({
  type,
  onSelect,
}: {
  type: GenrePageType;
  onSelect: (next: GenrePageType) => void;
}) {
  return (
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
            className={cn(
              'relative pb-2 text-sm transition-colors',
              active
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

  const rawType = searchParams.get('type') || 'all';
  const type: GenrePageType =
    rawType === 'movie' || rawType === 'tv' ? rawType : 'all';

  const [payload, setPayload] = useState<GenrePagePayload>(() =>
    peekGenrePageInitial(slug, type, preferences)
  );
  const initialFlags = syncGenreReadyFlags(payload);
  const [shellReady, setShellReady] = useState(initialFlags.shellReady);
  const [topRatedReady, setTopRatedReady] = useState(initialFlags.topRatedReady);
  const [newReady, setNewReady] = useState(initialFlags.newReady);
  const preferencesSig = useMemo(
    () => preferencesCacheKey(preferences),
    [preferences]
  );

  const loadGenrePage = useCallback(() => {
    const cached = peekGenrePageInitial(slug, type, preferences);
    const needs = genrePagePartNeeds(cached);

    if (!needs.shell && !needs.topRated && !needs.newRail) {
      setPayload(cached);
      const flags = syncGenreReadyFlags(cached);
      setShellReady(flags.shellReady);
      setTopRatedReady(flags.topRatedReady);
      setNewReady(flags.newReady);
      return;
    }

    if (needs.shell) {
      void fetchGenrePageShell(slug, type, preferences).then((shell) => {
        setPayload((prev) => ({
          ...prev,
          featured: shell.featured,
          total: shell.total,
          rails: {
            ...prev.rails,
            popular: shell.rails.popular,
          },
        }));
        setShellReady(true);
      });
    }

    if (needs.topRated) {
      void fetchGenrePageTopRated(slug, type, preferences).then((part) => {
        setPayload((prev) => ({
          ...prev,
          rails: {
            ...prev.rails,
            top_rated: part.rails.top_rated,
          },
        }));
        setTopRatedReady(true);
      });
    }

    if (needs.newRail) {
      void fetchGenrePageNew(slug, type, preferences).then((part) => {
        setPayload((prev) => ({
          ...prev,
          rails: {
            ...prev.rails,
            new: part.rails.new,
          },
        }));
        setNewReady(true);
      });
    }
  }, [slug, type, preferences]);

  const bustGenreInflight = useCallback(() => {
    bustInflightDayCache(genrePageCacheKey(slug, type, preferences));
    bustInflightDayCache(genrePageShellCacheKey(slug, type, preferences));
    bustInflightDayCache(genrePageTopRatedCacheKey(slug, type, preferences));
    bustInflightDayCache(genrePageNewCacheKey(slug, type, preferences));
  }, [slug, type, preferences]);

  useEffect(() => {
    document.title = `${genreLabel} - Teavie`;
  }, [genreLabel]);

  useLayoutEffect(() => {
    const cached = peekGenrePageInitial(slug, type, preferences);
    setPayload(cached);
    const flags = syncGenreReadyFlags(cached);
    setShellReady(flags.shellReady);
    setTopRatedReady(flags.topRatedReady);
    setNewReady(flags.newReady);
  }, [slug, type, preferencesSig, preferences]);

  useEffect(() => {
    let cancelled = false;
    const cached = peekGenrePageInitial(slug, type, preferences);
    const needs = genrePagePartNeeds(cached);

    if (!needs.shell && !needs.topRated && !needs.newRail) {
      return;
    }

    const fetches: Promise<void>[] = [];

    if (needs.shell) {
      fetches.push(
        fetchGenrePageShell(slug, type, preferences).then((shell) => {
          if (cancelled) return;
          setPayload((prev) => ({
            ...prev,
            featured: shell.featured,
            total: shell.total,
            rails: {
              ...prev.rails,
              popular: shell.rails.popular,
            },
          }));
          setShellReady(true);
        })
      );
    }

    if (needs.topRated) {
      fetches.push(
        fetchGenrePageTopRated(slug, type, preferences).then((part) => {
          if (cancelled) return;
          setPayload((prev) => ({
            ...prev,
            rails: {
              ...prev.rails,
              top_rated: part.rails.top_rated,
            },
          }));
          setTopRatedReady(true);
        })
      );
    }

    if (needs.newRail) {
      fetches.push(
        fetchGenrePageNew(slug, type, preferences).then((part) => {
          if (cancelled) return;
          setPayload((prev) => ({
            ...prev,
            rails: {
              ...prev.rails,
              new: part.rails.new,
            },
          }));
          setNewReady(true);
        })
      );
    }

    void Promise.all(fetches);

    return () => {
      cancelled = true;
    };
  }, [slug, type, preferencesSig, preferences]);

  const discoverPending = !shellReady || !topRatedReady || !newReady;
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
      mergeParams({ type: next });
    },
    [mergeParams]
  );

  const { featured, rails } = payload;
  const spotlightItems =
    featured.length > 0 ? featured : rails.popular.slice(0, SPOTLIGHT_MAX_ITEMS);
  const hasSpotlight = spotlightItems.length > 0;
  const hasAnyRail =
    rails.popular.length > 0 || rails.top_rated.length > 0 || rails.new.length > 0;
  const pageSettled = shellReady && topRatedReady && newReady;

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
            spotlightItems={spotlightItems}
            maxItems={SPOTLIGHT_MAX_ITEMS}
            rounded={false}
            flushLeft={false}
          />
        </section>
      ) : !shellReady ? (
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
        </section>
      ) : null}

      <div
        className={cn(
          RAIL_STACK_CLASS,
          MOBILE_CONTENT_INSET_LEFT,
          'w-full pb-10',
          (hasSpotlight || !shellReady) ? 'mt-0' : 'mt-2'
        )}
      >
        <GenreTypeFilter type={type} onSelect={onTypeSelect} />

        {RAIL_SECTIONS.map(({ sort, title }) => {
          const items = rails[sort];
          const ready =
            sort === 'popular'
              ? shellReady
              : sort === 'top_rated'
                ? topRatedReady
                : newReady;

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
