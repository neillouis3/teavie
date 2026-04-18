"use client";

import React, { useEffect, useState } from "react";
import { Chip } from "@heroui/react";
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
        <h2 className="mb-3 text-lg font-semibold text-foreground">Sequels</h2>
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
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h2 className="text-lg font-semibold text-foreground">Sequels</h2>
        <Chip size="sm" variant="flat" color="success" className="font-normal">
          Jikan
        </Chip>
      </div>
      <p className="mb-4 text-xs text-default-500">
        Every later season linked by MAL “Sequel” from here (not only the next one). Only shows
        titles already in Teavie.
      </p>
      <ul className={gridClass}>
        {items.map((item) => {
          const key = item.catalogId ?? `al-${item.anilistId ?? "ext"}`;
          const inCatalog = item.catalogId != null && item.catalogId !== "";
          const catalogKind =
            item.catalogType === "movie" ? "movie" : item.catalogType === "tv" ? "tv" : "tv";
          const displayKind =
            inCatalog ? catalogKind : item.malKind === "movie" ? "movie" : "tv";
          const href =
            item.catalogId != null && item.catalogId !== ""
              ? undefined
              : typeof item.externalUrl === "string" && item.externalUrl.length > 0
                ? item.externalUrl
                : item.anilistId != null
                  ? `https://anilist.co/anime/${item.anilistId}`
                  : typeof item.malId === "number" && item.malId > 0
                    ? `https://myanimelist.net/anime/${item.malId}`
                    : undefined;
          return (
            <li key={`${key}-${item.anilistId ?? "na"}-${item.topNote}`} className="min-w-0">
              <HorizontalCatalogCard
                id={item.catalogId ?? `al-${item.anilistId ?? "x"}`}
                title={item.title}
                year={item.year}
                type={displayKind}
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
