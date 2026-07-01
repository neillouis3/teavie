'use client';

import React, { useEffect, useState } from 'react';
import HorizontalCatalogCard from '@/components/ui/horizontalCatalogCard';
import SmallCard from '@/components/ui/smallCard';
import HorizontalCatalogCardLoading from '@/components/ui/horizontalCatalogCardLoading';
import SmallCardLoading from '@/components/ui/smallCardLoading';
import { useCatalogCardStyle } from '@/contexts/catalogCardStyleContext';
import ExploreSectionTitle from '@/components/explore/exploreSectionTitle';
import {
  CATALOG_GRID_HORIZONTAL_SEARCH,
  CATALOG_GRID_VERTICAL_SEARCH,
} from '@/lib/catalogGrid';

const YOU_MIGHT_LIKE_MAX_HORIZONTAL = 8;
const YOU_MIGHT_LIKE_MAX_VERTICAL = 14;

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

export default function YouMightLike({
  mediaType,
  id,
  isAnime,
  idMal,
}: {
  mediaType: 'movie' | 'tv';
  id: string;
  isAnime?: boolean;
  /** MAL id from `/shows/anime_{malId}` or doc — required for anime recommendations (Jikan). */
  idMal?: number | null;
}) {
  const [items, setItems] = useState<RecItem[]>([]);
  const [loading, setLoading] = useState(true);
  const { mode: cardLayout } = useCatalogCardStyle();
  const horizontal = cardLayout === 'horizontal';
  const maxItems = horizontal ? YOU_MIGHT_LIKE_MAX_HORIZONTAL : YOU_MIGHT_LIKE_MAX_VERTICAL;

  useEffect(() => {
    const controller = new AbortController();

    const runAnime = async () => {
      setLoading(true);
      try {
        const qs = new URLSearchParams();
        if (typeof idMal === 'number' && Number.isFinite(idMal) && idMal > 0) {
          qs.set('idMal', String(idMal));
        }
        qs.set('limit', String(maxItems));
        const res = await fetch(`/api/anilist/you-might-like?${qs.toString()}`, {
          signal: controller.signal,
        });
        const data = res.ok ? await res.json() : { items: [] };
        const rows = Array.isArray(data.items) ? data.items : [];
        setItems(
          rows
            .filter(
              (r: { catalogId?: string | null }) =>
                typeof r.catalogId === 'string' && r.catalogId.trim().length > 0
            )
            .slice(0, maxItems)
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
            )
        );
      } catch {
        setItems([]);
      } finally {
        setLoading(false);
      }
    };

    const runTmdb = async () => {
      if (!/^\d+$/.test(String(id))) {
        setLoading(false);
        setItems([]);
        return;
      }
      setLoading(true);
      try {
        const qs = new URLSearchParams({
          type: mediaType,
          id: String(id),
          limit: String(maxItems),
        });
        const res = await fetch(`/api/tmdb/you-might-like?${qs.toString()}`, {
          signal: controller.signal,
        });
        const data = res.ok ? await res.json() : { items: [] };
        const rows = Array.isArray(data.items) ? data.items : [];
        setItems(
          rows.slice(0, maxItems).map(
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
          )
        );
      } catch {
        setItems([]);
      } finally {
        setLoading(false);
      }
    };

    if (mediaType === 'tv' && isAnime) {
      const hasMal = typeof idMal === 'number' && Number.isFinite(idMal) && idMal > 0;
      if (!hasMal) {
        setItems([]);
        setLoading(false);
        return () => controller.abort();
      }
      void runAnime();
    } else {
      void runTmdb();
    }

    return () => controller.abort();
  }, [mediaType, id, isAnime, idMal, maxItems]);

  const gridClass = horizontal
    ? CATALOG_GRID_HORIZONTAL_SEARCH
    : CATALOG_GRID_VERTICAL_SEARCH;

  if (loading) {
    return (
      <section className="mt-10 w-full pt-8">
        <ExploreSectionTitle className="mb-4">You might like</ExploreSectionTitle>
        <div className={`${gridClass} items-start`}>
          {Array.from({ length: maxItems }).map((_, i) =>
            horizontal ? (
              <HorizontalCatalogCardLoading key={i} />
            ) : (
              <SmallCardLoading key={i} />
            )
          )}
        </div>
      </section>
    );
  }

  if (items.length === 0) return null;

  return (
    <section className="mt-10 w-full pt-8">
      <ExploreSectionTitle className="mb-4">You might like</ExploreSectionTitle>
      <ul className={`${gridClass} items-start`}>
        {items.map((item) => (
          <li key={`${item.keyId}-${item.linkId}`} className="min-w-0">
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
          </li>
        ))}
      </ul>
    </section>
  );
}
