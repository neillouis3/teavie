'use client';

import React, { useEffect, useState } from 'react';
import { Chip } from '@heroui/react';
import HorizontalCatalogCard from '@/components/ui/horizontalCatalogCard';
import { tmdbBearerToken } from '@/lib/tmdbAuth';

type RecItem = {
  tmdbId: number;
  linkId: string;
  title: string;
  poster_path: string | null;
  backdrop_path: string | null;
  year: string;
};

export default function YouMightLike({
  mediaType,
  id,
  isAnime,
}: {
  mediaType: 'movie' | 'tv';
  id: string;
  /** When true (anime show page), map TMDB recommendation ids → catalog `/shows/anime_*`. */
  isAnime?: boolean;
}) {
  const [items, setItems] = useState<RecItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = tmdbBearerToken();
    if (!token) {
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    setLoading(true);

    fetch(
      `https://api.themoviedb.org/3/${mediaType}/${id}/recommendations?language=en-US&page=1`,
      {
        signal: controller.signal,
        headers: {
          accept: 'application/json',
          Authorization: `Bearer ${token}`,
        },
      }
    )
      .then((res) => (res.ok ? res.json() : { results: [] }))
      .then(async (data) => {
        const slice = (data.results ?? []).slice(0, 12) as {
          id: number;
          title?: string;
          name?: string;
          poster_path?: string | null;
          backdrop_path?: string | null;
          release_date?: string | null;
          first_air_date?: string | null;
        }[];

        const base: RecItem[] = slice.map((r) => {
          const date = r.release_date ?? r.first_air_date ?? '';
          const year = date ? String(new Date(date).getFullYear()) : '—';
          const tmdbId = Number(r.id);
          return {
            tmdbId,
            linkId: Number.isFinite(tmdbId) && tmdbId > 0 ? String(tmdbId) : String(r.id),
            title: r.title ?? r.name ?? 'Untitled',
            poster_path: r.poster_path ?? null,
            backdrop_path: r.backdrop_path ?? null,
            year,
          };
        });

        if (mediaType !== 'tv' || !isAnime || base.length === 0) {
          setItems(base);
          return;
        }

        const ids = base.map((b) => b.tmdbId).filter((n) => n > 0);
        try {
          const mapRes = await fetch(
            `/api/tv/catalog-from-tmdb?ids=${encodeURIComponent(ids.join(','))}`,
            { signal: controller.signal }
          );
          const payload = mapRes.ok ? await mapRes.json() : { map: {} };
          const map: Record<string, string> =
            payload && typeof payload.map === 'object' && payload.map != null
              ? payload.map
              : {};
          setItems(
            base.map((b) => ({
              ...b,
              linkId: map[String(b.tmdbId)] ?? b.linkId,
            }))
          );
        } catch {
          setItems(base);
        }
      })
      .catch(() => setItems([]))
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [mediaType, id, isAnime]);

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

  return (
    <section className="mt-10 w-full border-t border-default-200/60 pt-8">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <h2 className="text-lg font-semibold text-foreground">You might like</h2>
        <Chip size="sm" variant="flat" color="success" className="font-normal">
          {mediaType === 'movie' ? 'Movies' : isAnime ? 'Anime (catalog)' : 'TV'}
        </Chip>
      </div>
      <ul className={gridClass}>
        {items.map((item) => (
          <li key={item.tmdbId} className="min-w-0">
            <HorizontalCatalogCard
              id={item.linkId}
              title={item.title}
              year={item.year}
              type={mediaType}
              posterPath={item.poster_path || ''}
              backdropPath={item.backdrop_path || ''}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}
