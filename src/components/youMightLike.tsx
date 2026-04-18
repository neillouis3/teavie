'use client';

import React, { useEffect, useState } from 'react';
import { Chip } from '@heroui/react';
import HorizontalCatalogCard from '@/components/ui/horizontalCatalogCard';
import { tmdbBearerToken } from '@/lib/tmdbAuth';

type RecItem = {
  keyId: number;
  linkId: string;
  title: string;
  poster_path: string | null;
  backdrop_path: string | null;
  year: string;
  /** Out-of-catalog AniList tiles */
  href?: string | null;
};

export default function YouMightLike({
  mediaType,
  id,
  isAnime,
  anilistId,
}: {
  mediaType: 'movie' | 'tv';
  id: string;
  isAnime?: boolean;
  /** Required for anime TV: AniList recommendations → `/shows/anime_*` in catalog. */
  anilistId?: number | null;
}) {
  const [items, setItems] = useState<RecItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();

    const runAnime = async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/anilist/you-might-like?anilistId=${anilistId}`,
          { signal: controller.signal }
        );
        const data = res.ok ? await res.json() : { items: [] };
        const rows = Array.isArray(data.items) ? data.items : [];
        setItems(
          rows.map(
            (r: {
              catalogId: string | null;
              anilistId: number;
              title: string;
              year: string;
              posterPath?: string;
              externalUrl?: string | null;
            }) => ({
              keyId: r.anilistId,
              linkId: r.catalogId ?? `al-${r.anilistId}`,
              title: r.title ?? 'Untitled',
              poster_path: r.posterPath ?? null,
              backdrop_path: null,
              year: r.year ?? '—',
              href:
                r.catalogId != null && r.catalogId !== ''
                  ? undefined
                  : typeof r.externalUrl === 'string' && r.externalUrl.length > 0
                    ? r.externalUrl
                    : `https://anilist.co/anime/${r.anilistId}`,
            })
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
        const res = await fetch(
          `https://api.themoviedb.org/3/${mediaType}/${id}/recommendations?language=en-US&page=1`,
          {
            signal: controller.signal,
            headers: {
              accept: 'application/json',
              Authorization: `Bearer ${token}`,
            },
          }
        );
        const data = res.ok ? await res.json() : { results: [] };
        const slice = (data.results ?? []).slice(0, 12) as {
          id: number;
          title?: string;
          name?: string;
          poster_path?: string | null;
          backdrop_path?: string | null;
          release_date?: string | null;
          first_air_date?: string | null;
        }[];
        setItems(
          slice.map((r) => {
            const date = r.release_date ?? r.first_air_date ?? '';
            const year = date ? String(new Date(date).getFullYear()) : '—';
            const tmdbId = Number(r.id);
            return {
              keyId: Number.isFinite(tmdbId) && tmdbId > 0 ? tmdbId : 0,
              linkId:
                Number.isFinite(tmdbId) && tmdbId > 0 ? String(tmdbId) : String(r.id),
              title: r.title ?? r.name ?? 'Untitled',
              poster_path: r.poster_path ?? null,
              backdrop_path: r.backdrop_path ?? null,
              year,
            };
          })
        );
      } catch {
        setItems([]);
      } finally {
        setLoading(false);
      }
    };

    if (mediaType === 'tv' && isAnime) {
      if (
        typeof anilistId !== 'number' ||
        !Number.isFinite(anilistId) ||
        anilistId <= 0
      ) {
        setItems([]);
        setLoading(false);
        return () => controller.abort();
      }
      void runAnime();
    } else {
      void runTmdb();
    }

    return () => controller.abort();
  }, [mediaType, id, isAnime, anilistId]);

  const gridMovie =
    'grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4';
  const gridTv =
    'grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4';
  const gridClass = mediaType === 'tv' ? gridTv : gridMovie;

  if (loading) {
    return (
      <section className="mt-10 w-full border-t border-default-200/60 pt-8">
        <h2 className="mb-4 text-lg font-semibold text-foreground">You might like</h2>
        <div className={gridClass}>
          {Array.from({ length: mediaType === 'tv' ? 8 : 6 }).map((_, i) => (
            <div
              key={i}
              className="aspect-[16/10] animate-pulse rounded-lg bg-default-200"
            />
          ))}
        </div>
      </section>
    );
  }

  if (items.length === 0) return null;

  const chipLabel =
    mediaType === 'movie'
      ? 'Movies'
      : isAnime
        ? 'AniList'
        : 'TV';

  return (
    <section className="mt-10 w-full border-t border-default-200/60 pt-8">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <h2 className="text-lg font-semibold text-foreground">You might like</h2>
        <Chip size="sm" variant="flat" color="success" className="font-normal">
          {chipLabel}
        </Chip>
      </div>
      <ul className={gridClass}>
        {items.map((item) => (
          <li key={`${item.keyId}-${item.linkId}`} className="min-w-0">
            <HorizontalCatalogCard
              id={item.linkId}
              title={item.title}
              year={item.year}
              type={mediaType}
              posterPath={item.poster_path || ''}
              backdropPath={item.backdrop_path || ''}
              href={item.href ?? undefined}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}
