'use client';

import React, { useEffect, useMemo, useState } from 'react';
import HorizontalCatalogCard from '@/components/ui/horizontalCatalogCard';
import SmallCard from '@/components/ui/smallCard';
import { useCatalogCardStyle } from '@/contexts/catalogCardStyleContext';
import ExploreSectionTitle from '@/components/explore/exploreSectionTitle';
import {
  CatalogRailShell,
  SIDEBAR_BLEED_CAROUSEL_OPTS,
  SidebarBleedStartSpacer,
  catalogRailViewportClass,
} from '@/components/ui/sidebarBleedRail';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
} from '@/components/ui/carousel';
import { CatalogRailSkeleton } from '@/components/catalog/catalogRail';
import {
  EXPLORE_RAIL_MAX_ITEMS,
  RAIL_CAROUSEL_ITEM_HORIZONTAL,
  RAIL_CAROUSEL_ITEM_VERTICAL,
  RAIL_TRACK,
} from '@/lib/catalogGrid';
import { readClientDayCache, writeClientDayCache } from '@/lib/clientDayCache';

const YOU_MIGHT_LIKE_MAX_HORIZONTAL = 8;
const YOU_MIGHT_LIKE_MAX_VERTICAL = EXPLORE_RAIL_MAX_ITEMS;
const YOU_MIGHT_LIKE_DETAIL_MAX = 5;
const YOU_MIGHT_LIKE_DETAIL_VERTICAL_ITEM =
  'basis-[45%] pl-3 sm:basis-[32%] md:basis-1/4 lg:basis-1/5';

const YML_CACHE_PREFIX = 'teavie.cache.yml.v1:';

type RecItem = {
  keyId: number;
  linkId: string;
  title: string;
  poster_path: string | null;
  backdrop_path: string | null;
  year: string;
  runtimeSeconds?: number | null;
  seasonAmount?: number;
  numberOfEpisodes?: number | null;
  /** Out-of-catalog AniList tiles */
  href?: string | null;
};

const ymlInflight = new Map<string, Promise<RecItem[]>>();

function ymlCacheKey(
  mediaType: 'movie' | 'tv',
  id: string,
  isAnime: boolean | undefined,
  idMal: number | null | undefined,
  bleed: boolean
) {
  if (mediaType === 'tv' && isAnime && typeof idMal === 'number' && idMal > 0) {
    return `${YML_CACHE_PREFIX}anime:${idMal}:${bleed ? 'explore' : 'detail'}`;
  }
  return `${YML_CACHE_PREFIX}${mediaType}:${id}:${bleed ? 'explore' : 'detail'}`;
}

function ymlFetchLimit(bleed: boolean) {
  return bleed ? YOU_MIGHT_LIKE_MAX_VERTICAL : YOU_MIGHT_LIKE_DETAIL_MAX;
}

async function fetchAnimeYml(idMal: number, limit: number): Promise<RecItem[]> {
  const qs = new URLSearchParams({
    idMal: String(idMal),
    limit: String(limit),
  });
  const res = await fetch(`/api/anilist/you-might-like?${qs.toString()}`);
  const data = res.ok ? await res.json() : { items: [] };
  const rows = Array.isArray(data.items) ? data.items : [];
  return rows
    .filter(
      (r: { catalogId?: string | null }) =>
        typeof r.catalogId === 'string' && r.catalogId.trim().length > 0
    )
    .slice(0, limit)
    .map(
      (r: {
        catalogId: string;
        anilistId: number | null;
        malId?: number;
        title: string;
        year: string;
        posterPath?: string;
        runtimeSeconds?: number | null;
        seasonAmount?: number;
        numberOfEpisodes?: number | null;
      }) => {
        const al =
          typeof r.anilistId === 'number' && Number.isFinite(r.anilistId) && r.anilistId > 0
            ? r.anilistId
            : null;
        const mal =
          typeof r.malId === 'number' && Number.isFinite(r.malId) && r.malId > 0 ? r.malId : 0;
        return {
          keyId: al ?? mal,
          linkId: r.catalogId,
          title: r.title ?? 'Untitled',
          poster_path: r.posterPath ?? null,
          backdrop_path: null,
          year: r.year ?? '—',
          runtimeSeconds: r.runtimeSeconds ?? null,
          seasonAmount: r.seasonAmount ?? 0,
          numberOfEpisodes: r.numberOfEpisodes ?? null,
        };
      }
    );
}

async function fetchTmdbYml(
  mediaType: 'movie' | 'tv',
  id: string,
  limit: number
): Promise<RecItem[]> {
  if (!/^\d+$/.test(String(id))) return [];
  const qs = new URLSearchParams({
    type: mediaType,
    id: String(id),
    limit: String(limit),
  });
  const res = await fetch(`/api/tmdb/you-might-like?${qs.toString()}`);
  const data = res.ok ? await res.json() : { items: [] };
  const rows = Array.isArray(data.items) ? data.items : [];
  return rows.slice(0, limit).map(
    (r: {
      keyId?: number;
      linkId: string;
      title: string;
      poster_path?: string | null;
      backdrop_path?: string | null;
      year?: string;
      runtimeSeconds?: number | null;
      seasonAmount?: number;
      numberOfEpisodes?: number | null;
    }) => ({
      keyId: Number(r.keyId) || Number(r.linkId) || 0,
      linkId: r.linkId,
      title: r.title ?? 'Untitled',
      poster_path: r.poster_path ?? null,
      backdrop_path: r.backdrop_path ?? null,
      year: r.year ?? '—',
      runtimeSeconds: r.runtimeSeconds ?? null,
      seasonAmount: r.seasonAmount ?? 0,
      numberOfEpisodes: r.numberOfEpisodes ?? null,
    })
  );
}

export default function YouMightLike({
  mediaType,
  id,
  isAnime,
  idMal,
  bleed = true,
}: {
  mediaType: 'movie' | 'tv';
  id: string;
  isAnime?: boolean;
  /** MAL id from `/shows/anime_{malId}` or doc — required for anime recommendations (Jikan). */
  idMal?: number | null;
  /** Extend carousel under the sidebar (Explore). Detail pages should pass false. */
  bleed?: boolean;
}) {
  const cacheKey = useMemo(
    () => ymlCacheKey(mediaType, id, isAnime, idMal, bleed),
    [mediaType, id, isAnime, idMal, bleed]
  );
  const fetchLimit = ymlFetchLimit(bleed);

  const [items, setItems] = useState<RecItem[]>(() => {
    if (typeof window === 'undefined') return [];
    return readClientDayCache<RecItem[]>(cacheKey) ?? [];
  });
  const [loading, setLoading] = useState(() => {
    if (typeof window === 'undefined') return true;
    const cached = readClientDayCache<RecItem[]>(cacheKey);
    return !(cached && cached.length > 0);
  });

  const { mode: cardLayout } = useCatalogCardStyle();
  const horizontal = cardLayout === 'horizontal';
  const maxItems = bleed
    ? horizontal
      ? YOU_MIGHT_LIKE_MAX_HORIZONTAL
      : YOU_MIGHT_LIKE_MAX_VERTICAL
    : YOU_MIGHT_LIKE_DETAIL_MAX;
  const visibleItems = useMemo(
    () => items.slice(0, maxItems),
    [items, maxItems]
  );
  const itemClass = horizontal
    ? RAIL_CAROUSEL_ITEM_HORIZONTAL
    : bleed
      ? RAIL_CAROUSEL_ITEM_VERTICAL
      : YOU_MIGHT_LIKE_DETAIL_VERTICAL_ITEM;

  useEffect(() => {
    let cancelled = false;
    const cached = readClientDayCache<RecItem[]>(cacheKey);

    if (cached?.length) {
      setItems(cached);
      setLoading(false);
    } else {
      setItems([]);
      setLoading(true);
    }

    if (mediaType === 'tv' && isAnime) {
      const hasMal = typeof idMal === 'number' && Number.isFinite(idMal) && idMal > 0;
      if (!hasMal) {
        setItems([]);
        setLoading(false);
        return;
      }
    } else if (!/^\d+$/.test(String(id))) {
      setItems([]);
      setLoading(false);
      return;
    }

    const load = () => {
      const existing = ymlInflight.get(cacheKey);
      if (existing) return existing;

      const promise =
        mediaType === 'tv' && isAnime
          ? fetchAnimeYml(idMal as number, fetchLimit)
          : fetchTmdbYml(mediaType, id, fetchLimit);

      const tracked = promise.finally(() => {
        ymlInflight.delete(cacheKey);
      });
      ymlInflight.set(cacheKey, tracked);
      return tracked;
    };

    void load()
      .then((rows) => {
        if (cancelled) return;
        setItems(rows);
        if (rows.length > 0) writeClientDayCache(cacheKey, rows);
      })
      .catch(() => {
        if (cancelled) return;
        if (!cached?.length) setItems([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [cacheKey, mediaType, id, isAnime, idMal, fetchLimit]);

  if (loading && visibleItems.length === 0) {
    return (
      <section className="mt-10 flex w-full flex-col gap-3 pt-8" aria-label="More like this">
        <ExploreSectionTitle variant="explore" hideIcon>
          More like this
        </ExploreSectionTitle>
        <CatalogRailShell bleed={bleed}>
          <CatalogRailSkeleton horizontal={horizontal} bleed={bleed} />
        </CatalogRailShell>
      </section>
    );
  }

  if (visibleItems.length === 0) return null;

  return (
    <section className="mt-10 flex w-full flex-col gap-3 pt-8" aria-label="More like this">
      <ExploreSectionTitle variant="explore" hideIcon>
        More like this
      </ExploreSectionTitle>
      <CatalogRailShell bleed={bleed}>
        <Carousel opts={SIDEBAR_BLEED_CAROUSEL_OPTS} className="w-full">
          <CarouselContent
            viewportClassName={catalogRailViewportClass(bleed)}
            className={RAIL_TRACK}
          >
            {bleed ? <SidebarBleedStartSpacer /> : null}
            {visibleItems.map((item) => (
              <CarouselItem
                key={`${item.keyId}-${item.linkId}`}
                className={itemClass}
              >
                {horizontal ? (
                  <HorizontalCatalogCard
                    id={item.linkId}
                    title={item.title}
                    year={item.year}
                    type={mediaType}
                    posterPath={item.poster_path || ''}
                    backdropPath={item.backdrop_path || ''}
                    href={item.href ?? undefined}
                  />
                ) : (
                  <SmallCard
                    id={item.linkId}
                    title={item.title}
                    year={item.year}
                    type={mediaType}
                    runtimeSeconds={item.runtimeSeconds ?? undefined}
                    seasonAmount={item.seasonAmount ?? 0}
                    numberOfEpisodes={item.numberOfEpisodes ?? undefined}
                    posterPath={item.poster_path || ''}
                    linkHref={item.href ?? undefined}
                  />
                )}
              </CarouselItem>
            ))}
          </CarouselContent>
        </Carousel>
      </CatalogRailShell>
    </section>
  );
}
