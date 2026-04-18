'use client';

import React, { useEffect, useMemo, useState } from 'react';
import HorizontalCatalogCard from '@/components/ui/horizontalCatalogCard';
import { tmdbBearerToken } from '@/lib/tmdbAuth';

type FranchiseItem = {
  id: number;
  title: string;
  year: string;
  poster_path: string | null;
  backdrop_path: string | null;
  topNote?: string;
};

type MovieDetail = {
  belongs_to_collection?: { id: number; name?: string } | null;
};

type CollectionDetail = {
  name?: string;
  parts?: {
    id: number;
    title?: string;
    poster_path?: string | null;
    backdrop_path?: string | null;
    release_date?: string | null;
  }[];
};

function ymd(d: string | null | undefined): string {
  const s = String(d ?? '').trim();
  return s.length >= 10 ? s.slice(0, 10) : '';
}

export default function MovieFranchiseSection({ id }: { id: string }) {
  const [items, setItems] = useState<FranchiseItem[]>([]);
  const [title, setTitle] = useState<string>('Franchise');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = tmdbBearerToken();
    if (!token || !/^\d+$/.test(String(id))) {
      setLoading(false);
      setItems([]);
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    setItems([]);

    const run = async () => {
      const res = await fetch(`https://api.themoviedb.org/3/movie/${id}?language=en-US`, {
        signal: controller.signal,
        headers: {
          accept: 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
      if (!res.ok) {
        setItems([]);
        setLoading(false);
        return;
      }
      const detail = (await res.json()) as MovieDetail;
      const colId = detail?.belongs_to_collection?.id;
      const colName = detail?.belongs_to_collection?.name;
      if (!colId || !Number.isFinite(Number(colId))) {
        setItems([]);
        setLoading(false);
        return;
      }

      const res2 = await fetch(
        `https://api.themoviedb.org/3/collection/${colId}?language=en-US`,
        {
          signal: controller.signal,
          headers: {
            accept: 'application/json',
            Authorization: `Bearer ${token}`,
          },
        }
      );
      if (!res2.ok) {
        setItems([]);
        setLoading(false);
        return;
      }
      const col = (await res2.json()) as CollectionDetail;
      setTitle(String(col?.name || colName || 'Franchise'));
      const parts = Array.isArray(col.parts) ? col.parts : [];
      const normalized = parts
        .map((p) => {
          const rid = Number(p.id);
          if (!Number.isFinite(rid) || rid <= 0) return null;
          const date = ymd(p.release_date);
          const year = date ? date.slice(0, 4) : '—';
          return {
            id: rid,
            title: p.title ?? 'Untitled',
            year,
            poster_path: p.poster_path ?? null,
            backdrop_path: p.backdrop_path ?? null,
            _date: date,
          };
        })
        .filter(Boolean) as (FranchiseItem & { _date: string })[];

      normalized.sort((a, b) => {
        if (a._date && b._date) return a._date.localeCompare(b._date);
        if (a._date) return -1;
        if (b._date) return 1;
        return a.title.localeCompare(b.title);
      });

      const currentId = Number(id);
      const idx = normalized.findIndex((x) => x.id === currentId);
      const withNotes: FranchiseItem[] = normalized.map((x, i) => {
        if (idx >= 0 && i === idx - 1) return { ...x, topNote: 'Prequel' };
        if (idx >= 0 && i === idx + 1) return { ...x, topNote: 'Sequel' };
        return x;
      });

      setItems(withNotes);
      setLoading(false);
    };

    void run().catch(() => {
      setItems([]);
      setLoading(false);
    });

    return () => controller.abort();
  }, [id]);

  const railClass =
    'grid w-full grid-flow-col grid-rows-2 gap-3 overflow-x-auto pb-2 pr-2 [scrollbar-width:thin]';
  const wrapClass = 'w-[240px] sm:w-[280px] md:w-[320px] lg:w-[340px]';

  const show = useMemo(() => items.filter((x) => x.id !== Number(id)), [items, id]);
  if (!loading && show.length <= 1) return null;

  return (
    <section className="mt-10 w-full pt-8">
      <h2 className="mb-4 text-lg font-semibold text-foreground">{title}</h2>
      {loading ? (
        <div className={railClass}>
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className={`${wrapClass} aspect-[16/10] animate-pulse rounded-lg bg-default-200`}
            />
          ))}
        </div>
      ) : (
        <ul className={railClass}>
          {show.map((item) => (
            <li key={item.id} className={`min-w-0 ${wrapClass}`}>
              <HorizontalCatalogCard
                id={item.id}
                title={item.title}
                year={item.year}
                type="movie"
                posterPath={item.poster_path || ''}
                backdropPath={item.backdrop_path || ''}
                topNote={item.topNote}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

