'use client';

import React, { useEffect, useState } from 'react';
import HorizontalCatalogCard from '@/components/ui/horizontalCatalogCard';
import SmallCard from '@/components/ui/smallCard';
import HorizontalCatalogCardLoading from '@/components/ui/horizontalCatalogCardLoading';
import SmallCardLoading from '@/components/ui/smallCardLoading';
import { tmdbBearerToken } from '@/lib/tmdbAuth';
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

async function fetchCatalogCardMeta(
  items: RecItem[],
  mediaType: 'movie' | 'tv',
  signal?: AbortSignal
): Promise<RecItem[]> {
  if (items.length === 0) return items;
  const qs = new URLSearchParams({
    type: mediaType,
    ids: items.map((i) => i.linkId).join(','),
  });
  const res = await fetch(`/api/catalog/card-meta?${qs}`, { signal });
  const data = res.ok ? await res.json() : { meta: {} };
  const meta = (data.meta ?? {}) as Record<
    string,
    { runtimeSeconds?: number | null; seasonAmount?: number; numberOfEpisodes?: number | null }
  >;
  return items.map((item) => {
    const row = meta[item.linkId];
    if (!row) return item;
    return {
      ...item,
      runtimeSeconds: row.runtimeSeconds ?? item.runtimeSeconds,
      seasonAmount: row.seasonAmount ?? item.seasonAmount,
      numberOfEpisodes: row.numberOfEpisodes ?? item.numberOfEpisodes,
    };
  });
}

type TmdbRecRow = {
  id: number;
  title?: string;
  name?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  release_date?: string | null;
  first_air_date?: string | null;
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
      const token = tmdbBearerToken();
      if (!token || !/^\d+$/.test(String(id))) {
        setLoading(false);
        setItems([]);
        return;
      }
      setLoading(true);
      try {
        const headers = {
          accept: 'application/json',
          Authorization: `Bearer ${token}`,
        } as const;

        const takeRows = (payload: unknown): TmdbRecRow[] =>
          (Array.isArray(payload) ? payload : []) as TmdbRecRow[];

        const mergeRows = (seen: Set<number>, out: RecItem[], rows: TmdbRecRow[]) => {
          for (const r of rows) {
            const tmdbId = Number(r?.id);
            if (!Number.isFinite(tmdbId) || tmdbId <= 0) continue;
            if (tmdbId === Number(id)) continue;
            if (seen.has(tmdbId)) continue;
            seen.add(tmdbId);
            const date = r.release_date ?? r.first_air_date ?? '';
            const year = date ? String(new Date(date).getFullYear()) : '—';
            out.push({
              keyId: tmdbId,
              linkId: String(tmdbId),
              title: r.title ?? r.name ?? 'Untitled',
              poster_path: r.poster_path ?? null,
              backdrop_path: r.backdrop_path ?? null,
              year,
            });
            if (out.length >= maxItems) break;
          }
        };

        const out: RecItem[] = [];
        const seen = new Set<number>();

        const [recRes, simRes, popRes] = await Promise.all([
          fetch(
            `https://api.themoviedb.org/3/${mediaType}/${id}/recommendations?language=en-US&page=1`,
            { signal: controller.signal, headers }
          ),
          fetch(
            `https://api.themoviedb.org/3/${mediaType}/${id}/similar?language=en-US&page=1`,
            { signal: controller.signal, headers }
          ),
          fetch(
            `https://api.themoviedb.org/3/${mediaType}/popular?language=en-US&page=1`,
            { signal: controller.signal, headers }
          ),
        ]);

        const [recJson, simJson, popJson] = await Promise.all([
          recRes.ok ? recRes.json() : { results: [] },
          simRes.ok ? simRes.json() : { results: [] },
          popRes.ok ? popRes.json() : { results: [] },
        ]);

        mergeRows(seen, out, takeRows(recJson.results));
        if (out.length < maxItems) {
          mergeRows(seen, out, takeRows(simJson.results));
        }
        if (out.length < maxItems) {
          mergeRows(seen, out, takeRows(popJson.results));
        }

        const enriched = await fetchCatalogCardMeta(
          out.slice(0, maxItems),
          mediaType,
          controller.signal
        );
        setItems(enriched);
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
