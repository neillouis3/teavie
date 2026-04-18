"use client";

import React, { useEffect, useState } from "react";
import { Chip } from "@heroui/react";
import HorizontalCatalogCard from "@/components/ui/horizontalCatalogCard";

type RelatedItem = {
  catalogId: string | null;
  catalogType?: "movie" | "tv" | string | null;
  anilistId: number | null;
  title: string;
  year: string;
  posterPath: string;
  topNote: string;
};

export default function AnimeRelatedSection({
  anilistId,
  tmdbTvId,
}: {
  anilistId: number;
  tmdbTvId?: number | null;
}) {
  const [items, setItems] = useState<RelatedItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!Number.isFinite(anilistId) || anilistId <= 0) {
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    const qs = new URLSearchParams({ anilistId: String(anilistId) });
    if (tmdbTvId != null && Number.isFinite(tmdbTvId) && tmdbTvId > 0) {
      qs.set("tmdbTvId", String(tmdbTvId));
    }
    fetch(`/api/anilist/related?${qs.toString()}`, { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : { items: [] }))
      .then((data) => setItems(Array.isArray(data.items) ? data.items : []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [anilistId, tmdbTvId]);

  const gridClass =
    "grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4";

  if (loading) {
    return (
      <section className="w-full border-t border-default-200/60 pt-6">
        <h2 className="mb-3 text-lg font-semibold text-foreground">
          Related in franchise
        </h2>
        <div className={gridClass}>
          {Array.from({ length: 6 }).map((_, i) => (
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
    <section className="w-full border-t border-default-200/60 pt-6">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h2 className="text-lg font-semibold text-foreground">
          Related in franchise
        </h2>
        <Chip size="sm" variant="flat" color="success" className="font-normal">
          AniList + catalog
        </Chip>
      </div>
      <p className="mb-4 text-xs text-default-500">
        Franchise links from AniList matched to movies and TV in Teavie; similar titles from TMDB fill in
        when needed. External tiles open on AniList until imported.
      </p>
      <ul className={gridClass}>
        {items.map((item) => {
          const key = item.catalogId ?? `al-${item.anilistId ?? "ext"}`;
          const catalogKind =
            item.catalogType === "movie" ? "movie" : item.catalogType === "tv" ? "tv" : "tv";
          const href =
            item.catalogId != null && item.catalogId !== ""
              ? undefined
              : item.anilistId != null
                ? `https://anilist.co/anime/${item.anilistId}`
                : undefined;
          return (
            <li key={`${key}-${item.anilistId ?? "na"}`} className="min-w-0">
              <HorizontalCatalogCard
                id={item.catalogId ?? `al-${item.anilistId ?? "x"}`}
                title={item.title}
                year={item.year}
                type={item.catalogId ? catalogKind : "tv"}
                posterPath={item.posterPath || ""}
                backdropPath=""
                topNote={
                  item.catalogId
                    ? item.topNote
                    : `${item.topNote} · not in catalog`
                }
                href={href}
              />
            </li>
          );
        })}
      </ul>
    </section>
  );
}
