"use client";

import React, { useEffect, useState } from "react";
import HorizontalCatalogCard from "@/components/ui/horizontalCatalogCard";
import SmallCard from "@/components/ui/smallCard";
import HorizontalCatalogCardLoading from "@/components/ui/horizontalCatalogCardLoading";
import SmallCardLoading from "@/components/ui/smallCardLoading";
import { useCatalogCardStyle } from "@/contexts/catalogCardStyleContext";
import ExploreSectionTitle from "@/components/explore/exploreSectionTitle";
import {
  CATALOG_GRID_HORIZONTAL_SEARCH,
  CATALOG_GRID_VERTICAL_SEARCH,
} from "@/lib/catalogGrid";

type RelatedItem = {
  catalogId: string | null;
  catalogType?: "movie" | "tv" | string | null;
  anilistId: number | null;
  malId?: number;
  malKind?: "anime" | "movie";
  title: string;
  year: string;
  posterPath: string;
  backdropPath?: string;
  seasonAmount?: number;
  numberOfEpisodes?: number | null;
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
  const { mode: cardLayout } = useCatalogCardStyle();
  const horizontal = cardLayout === "horizontal";

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
      .then((data) => {
        const raw = Array.isArray(data.items) ? data.items : [];
        setItems(
          raw.filter(
            (it: RelatedItem) =>
              typeof it.catalogId === "string" && it.catalogId.trim().length > 0
          )
        );
      })
      .catch(() => setItems([]))
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [idMal]);

  const gridClass = horizontal
    ? CATALOG_GRID_HORIZONTAL_SEARCH
    : CATALOG_GRID_VERTICAL_SEARCH;

  if (loading) {
    return (
      <section className="w-full pt-6">
        <ExploreSectionTitle className="mb-3">Related anime</ExploreSectionTitle>
        <div className={`${gridClass} items-start`}>
          {Array.from({ length: 6 }).map((_, i) =>
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
    <section className="w-full pt-6">
      <ExploreSectionTitle className="mb-3">Related anime</ExploreSectionTitle>
      <ul className={`${gridClass} items-start`}>
        {items.map((item) => {
          const key = item.catalogId ?? `al-${item.anilistId ?? "ext"}`;
          const catalogKind =
            item.catalogType === "movie" ? "movie" : item.catalogType === "tv" ? "tv" : "tv";
          const outHref =
            item.catalogId && String(item.catalogId).trim().length > 0
              ? undefined
              : item.externalUrl && String(item.externalUrl).trim().length > 0
                ? String(item.externalUrl).trim()
                : undefined;
          return (
            <li
              key={`${key}-${item.anilistId ?? "na"}-${item.topNote}`}
              className="min-w-0"
            >
              {horizontal ? (
                <HorizontalCatalogCard
                  id={item.catalogId ?? ""}
                  title={item.title}
                  year={item.year}
                  type={catalogKind}
                  posterPath={item.posterPath || ""}
                  backdropPath={item.backdropPath || ""}
                  topNote={item.topNote}
                  href={outHref}
                />
              ) : (
                <SmallCard
                  id={item.catalogId ?? `al-${item.anilistId ?? 0}`}
                  title={item.title}
                  year={item.year}
                  type={catalogKind}
                  seasonAmount={item.seasonAmount ?? 0}
                  numberOfEpisodes={item.numberOfEpisodes ?? undefined}
                  posterPath={item.posterPath || ""}
                  linkHref={outHref}
                  releaseNote={item.topNote}
                />
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
