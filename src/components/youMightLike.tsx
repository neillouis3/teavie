'use client';

import React, { useEffect, useState } from 'react';
import HorizontalCatalogCard from '@/components/ui/horizontalCatalogCard';
import { tmdbBearerToken } from '@/lib/tmdbAuth';

const YOU_MIGHT_LIKE_MAX = 8;

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

  useEffect(() => {
    const controller = new AbortController();

    const runAnime = async () => {
      setLoading(true);
      try {
        const qs = new URLSearchParams();
        if (typeof idMal === 'number' && Number.isFinite(idMal) && idMal > 0) {
          qs.set('idMal', String(idMal));
        }
        const res = await fetch(`/api/anilist/you-might-like?${qs.toString()}`, {
          signal: controller.signal,
        });
        const data = res.ok ? await res.json() : { items: [] };
        const rows = Array.isArray(data.items) ? data.items : [];
        setItems(
          rows.slice(0, YOU_MIGHT_LIKE_MAX).map(
            (r: {
              catalogId: string | null;
              anilistId: number | null;
              malId?: number;
              title: string;
              year: string;
              posterPath?: string;
              externalUrl?: string | null;
            }) => {
              const al =
                typeof r.anilistId === 'number' && Number.isFinite(r.anilistId) && r.anilistId > 0
                  ? r.anilistId
                  : null;
              const mal =
                typeof r.malId === 'number' && Number.isFinite(r.malId) && r.malId > 0 ? r.malId : 0;
              const keyId = al ?? mal;
              const inCatalog = r.catalogId != null && r.catalogId !== '';
              return {
                keyId,
                linkId: inCatalog ? r.catalogId! : al != null ? `al-${al}` : `mal-${mal}`,
                title: r.title ?? 'Untitled',
                poster_path: r.posterPath ?? null,
                backdrop_path: null,
                year: r.year ?? '—',
                href: inCatalog
                  ? undefined
                  : typeof r.externalUrl === 'string' && r.externalUrl.length > 0
                    ? r.externalUrl
                    : al != null
                      ? `https://anilist.co/anime/${al}`
                      : undefined,
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
        const slice = (data.results ?? []).slice(0, YOU_MIGHT_LIKE_MAX) as {
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
  }, [mediaType, id, isAnime, idMal]);

  const railClass =
    'grid w-full grid-flow-col grid-rows-2 auto-rows-min items-start content-start gap-x-3 gap-y-2 overflow-x-auto pb-2 pr-2 [scrollbar-width:thin]';
  const wrapClass = 'w-[240px] sm:w-[280px] md:w-[320px] lg:w-[340px]';

  if (loading) {
    return (
      <section className="mt-10 w-full pt-8">
        <h2 className="mb-4 text-lg font-semibold text-foreground">You might like</h2>
        <div className={railClass}>
          {Array.from({ length: YOU_MIGHT_LIKE_MAX }).map((_, i) => (
            <div
              key={i}
              className={`${wrapClass} aspect-[16/10] animate-pulse rounded-lg bg-default-200`}
            />
          ))}
        </div>
      </section>
    );
  }

  if (items.length === 0) return null;

  return (
    <section className="mt-10 w-full pt-8">
      <h2 className="mb-4 text-lg font-semibold text-foreground">You might like</h2>
      <ul className={railClass}>
        {items.map((item) => (
          <li key={`${item.keyId}-${item.linkId}`} className={`min-w-0 ${wrapClass}`}>
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
