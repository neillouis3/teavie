"use client";

import React, { useEffect, useState } from "react";
import HorizontalCatalogCard from "@/components/ui/horizontalCatalogCard";
import SmallCard from "@/components/ui/smallCard";
import { useCatalogCardStyle } from "@/contexts/catalogCardStyleContext";
import {
  CATALOG_GRID_HORIZONTAL_SEARCH,
  CATALOG_GRID_VERTICAL_SEARCH,
} from "@/lib/catalogGrid";
import { clearLegacyAnimeShowRailsCache } from "@/lib/clientDayCache";

type RelatedItem = {
  catalogId: string;
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

type YmlItem = {
  catalogId: string;
  malId?: number;
  anilistId: number | null;
  title: string;
  year: string;
  posterPath?: string;
  backdropPath?: string;
  runtimeSeconds?: number | null;
  seasonAmount?: number;
  numberOfEpisodes?: number | null;
};

async function fetchRelatedAnime(idMal: number): Promise<RelatedItem[]> {
  const qs = new URLSearchParams({ idMal: String(idMal) });
  const res = await fetch(`/api/anilist/related?${qs.toString()}`, {
    cache: "no-store",
  });
  if (!res.ok) return [];
  const data = await res.json();
  const items = Array.isArray(data.items) ? data.items : [];
  return items.filter(
    (it: RelatedItem) =>
      typeof it.catalogId === "string" && it.catalogId.trim().length > 0
  );
}

async function fetchYouMightLike(idMal: number, limit: number): Promise<YmlItem[]> {
  const qs = new URLSearchParams({
    idMal: String(idMal),
    limit: String(limit),
  });
  const res = await fetch(`/api/anilist/you-might-like?${qs.toString()}`, {
    cache: "no-store",
  });
  if (!res.ok) return [];
  const data = await res.json();
  const items = Array.isArray(data.items) ? data.items : [];
  return items.filter(
    (it: YmlItem) =>
      typeof it.catalogId === "string" && it.catalogId.trim().length > 0
  );
}

export default function AnimeShowRails({
  idMal,
}: {
  idMal: number;
}) {
  const [related, setRelated] = useState<RelatedItem[]>([]);
  const [youMightLike, setYouMightLike] = useState<YmlItem[]>([]);
  const [loading, setLoading] = useState(true);
  const { mode: cardLayout } = useCatalogCardStyle();
  const horizontal = cardLayout === "horizontal";
  const ymlMax = horizontal ? 8 : 14;

  useEffect(() => {
    clearLegacyAnimeShowRailsCache();
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void Promise.all([
      fetchRelatedAnime(idMal),
      fetchYouMightLike(idMal, ymlMax),
    ])
      .then(([relatedItems, ymlItems]) => {
        if (cancelled) return;
        setRelated(relatedItems);
        setYouMightLike(ymlItems);
      })
      .catch(() => {
        if (cancelled) return;
        setRelated([]);
        setYouMightLike([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [idMal, ymlMax]);

  const gridClass = horizontal
    ? CATALOG_GRID_HORIZONTAL_SEARCH
    : CATALOG_GRID_VERTICAL_SEARCH;

  if (loading) {
    return null;
  }

  if (related.length === 0 && youMightLike.length === 0) {
    return null;
  }

  return (
    <>
      {related.length > 0 ? (
        <section className="w-full pt-6">
          <h2 className="mb-3 text-lg font-semibold text-foreground">Related anime</h2>
          <ul className={`${gridClass} items-start`}>
            {related.map((item) => {
              const catalogKind =
                item.catalogType === "movie" ? "movie" : "tv";
              return (
                <li
                  key={`${item.catalogId}-${item.anilistId ?? "na"}-${item.topNote}`}
                  className="min-w-0"
                >
                  {horizontal ? (
                    <HorizontalCatalogCard
                      id={item.catalogId}
                      title={item.title}
                      year={item.year}
                      type={catalogKind}
                      posterPath={item.posterPath || ""}
                      backdropPath={item.backdropPath || ""}
                      topNote={item.topNote}
                    />
                  ) : (
                    <SmallCard
                      id={item.catalogId}
                      title={item.title}
                      year={item.year}
                      type={catalogKind}
                      seasonAmount={item.seasonAmount ?? 0}
                      numberOfEpisodes={item.numberOfEpisodes ?? undefined}
                      posterPath={item.posterPath || ""}
                      releaseNote={item.topNote}
                    />
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {youMightLike.length > 0 ? (
        <section className="mt-10 w-full pt-8">
          <h2 className="mb-4 text-lg font-semibold text-foreground">You might like</h2>
          <ul className={`${gridClass} items-start`}>
            {youMightLike.map((item) => (
              <li key={`${item.catalogId}-${item.malId ?? "na"}`} className="min-w-0">
                {horizontal ? (
                  <HorizontalCatalogCard
                    id={item.catalogId}
                    title={item.title}
                    year={item.year}
                    type="tv"
                    posterPath={item.posterPath || ""}
                    backdropPath={item.backdropPath || ""}
                  />
                ) : (
                  <SmallCard
                    id={item.catalogId}
                    title={item.title}
                    year={item.year}
                    type="tv"
                    runtimeSeconds={item.runtimeSeconds ?? undefined}
                    seasonAmount={item.seasonAmount ?? 0}
                    numberOfEpisodes={item.numberOfEpisodes ?? undefined}
                    posterPath={item.posterPath || ""}
                  />
                )}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}
