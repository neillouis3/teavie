"use client";

import React, { useEffect, useState } from "react";
import { Chip } from "@heroui/react";
import HorizontalCatalogCard from "@/components/ui/horizontalCatalogCard";

type RelatedItem = {
  catalogId: string;
  anilistId: number;
  title: string;
  year: string;
  posterPath: string;
  topNote: string;
};

export default function AnimeRelatedSection({
  anilistId,
}: {
  anilistId: number;
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
    fetch(`/api/anilist/related?anilistId=${anilistId}`, { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : { items: [] }))
      .then((data) => setItems(Array.isArray(data.items) ? data.items : []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [anilistId]);

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
          AniList
        </Chip>
      </div>
      <p className="mb-4 text-xs text-default-500">
        Sequels, prequels, and similar series in your catalog (separate seasons often
        have their own entry).
      </p>
      <ul className={gridClass}>
        {items.map((item) => (
          <li key={`${item.catalogId}-${item.anilistId}`} className="min-w-0">
            <HorizontalCatalogCard
              id={item.catalogId}
              title={item.title}
              year={item.year}
              type="tv"
              posterPath={item.posterPath || ""}
              backdropPath=""
              topNote={item.topNote}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}
