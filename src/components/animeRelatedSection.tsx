"use client";

import React, { useEffect, useState } from "react";
import HorizontalCatalogCard from "@/components/ui/horizontalCatalogCard";

type RelatedItem = {
  catalogId: string | null;
  catalogType?: "movie" | "tv" | string | null;
  anilistId: number | null;
  malId?: number;
  /** From Jikan when not in Teavie catalog (MAL `movie` vs `anime`). */
  malKind?: "anime" | "movie";
  title: string;
  year: string;
  posterPath: string;
  topNote: string;
  externalUrl?: string | null;
};

export default function AnimeRelatedSection({
  idMal,
}: {
  /** MAL id from `/shows/anime_{malId}` or doc — required for Jikan (no AniList idMal lookup). */
  idMal?: number | null;
}) {
  const [items, setItems] = useState<RelatedItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const malOk = typeof idMal === "number" && Number.isFinite(idMal) && idMal > 0;
    if (!malOk) {
      setLoading(false);
      setItems([]);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    const qs = new URLSearchParams();
    qs.set("idMal", String(idMal));
    fetch(`/api/anilist/related?${qs.toString()}`, { signal: controller.signal })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (
          process.env.NODE_ENV === "development" &&
          (!res.ok || (typeof data.error === "string" && data.error))
        ) {
          console.warn("[AnimeRelatedSection API]", res.status, data);
        }
        return data;
      })
      .then((data) => setItems(Array.isArray(data.items) ? data.items : []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [idMal]);

  const gridClass =
    "grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4";

  if (loading) {
    return (
      <section className="w-full pt-6">
        <h2 className="mb-3 text-lg font-semibold text-foreground">Related anime</h2>
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
    <section className="w-full pt-6">
      <h2 className="mb-3 text-lg font-semibold text-foreground">Related anime</h2>
      <ul className={gridClass}>
        {items.map((item) => {
          const key = item.catalogId ?? `al-${item.anilistId ?? "ext"}`;
          const catalogKind =
            item.catalogType === "movie" ? "movie" : item.catalogType === "tv" ? "tv" : "tv";
          return (
            <li key={`${key}-${item.anilistId ?? "na"}-${item.topNote}`} className="min-w-0">
              <HorizontalCatalogCard
                id={item.catalogId ?? ""}
                title={item.title}
                year={item.year}
                type={catalogKind}
                posterPath={item.posterPath || ""}
                backdropPath=""
                topNote={item.topNote}
                href={undefined}
              />
            </li>
          );
        })}
      </ul>
    </section>
  );
}
