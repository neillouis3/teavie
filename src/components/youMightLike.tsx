'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Chip } from '@heroui/react';

type RecItem = {
  id: number;
  title: string;
  poster_path: string | null;
};

export default function YouMightLike({
  mediaType,
  id,
}: {
  mediaType: 'movie' | 'tv';
  id: string;
}) {
  const [items, setItems] = useState<RecItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = process.env.NEXT_PUBLIC_TMDB_BEARER;
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
      .then((data) => {
        const rows = (data.results ?? []).slice(0, 12).map((r: { id: number; title?: string; name?: string; poster_path?: string | null }) => ({
          id: r.id,
          title: r.title ?? r.name ?? 'Untitled',
          poster_path: r.poster_path ?? null,
        }));
        setItems(rows);
      })
      .catch(() => setItems([]))
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [mediaType, id]);

  if (loading) {
    return (
      <section className="mt-10 w-full border-t border-default-200/60 pt-8">
        <h2 className="mb-4 text-lg font-semibold text-foreground">You might like</h2>
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="aspect-[2/3] animate-pulse rounded-lg bg-default-200"
            />
          ))}
        </div>
      </section>
    );
  }

  if (items.length === 0) return null;

  const base = 'https://image.tmdb.org/t/p/w342';

  return (
    <section className="mt-10 w-full border-t border-default-200/60 pt-8">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <h2 className="text-lg font-semibold text-foreground">You might like</h2>
        <Chip size="sm" variant="flat" color="success" className="font-normal">
          {mediaType === 'movie' ? 'Movies' : 'TV'}
        </Chip>
      </div>
      <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
        {items.map((item) => {
          const href =
            mediaType === 'movie' ? `/movies/${item.id}` : `/shows/${item.id}`;
          const src = item.poster_path ? `${base}${item.poster_path}` : null;
          return (
            <li key={item.id} className="min-w-0">
              <Link href={href} className="group block">
                <div className="relative aspect-[2/3] overflow-hidden rounded-lg bg-default-200 ring-1 ring-white/10">
                  {src ? (
                    <Image
                      src={src}
                      alt={item.title}
                      fill
                      sizes="(max-width: 640px) 33vw, (max-width: 1024px) 25vw, 16vw"
                      className="object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center p-2 text-center text-[10px] text-default-500">
                      No poster
                    </div>
                  )}
                </div>
                <p className="mt-1.5 line-clamp-2 text-xs font-medium text-foreground group-hover:text-success">
                  {item.title}
                </p>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
