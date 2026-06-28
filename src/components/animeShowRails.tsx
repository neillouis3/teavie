"use client";

import React, { useEffect, useState } from "react";
import HorizontalCatalogCard from "@/components/ui/horizontalCatalogCard";
import SmallCard from "@/components/ui/smallCard";
import { useCatalogCardStyle } from "@/contexts/catalogCardStyleContext";
import {
  CATALOG_GRID_HORIZONTAL_SEARCH,
  CATALOG_GRID_VERTICAL_SEARCH,
} from "@/lib/catalogGrid";
import { readClientDayCache, writeClientDayCache } from "@/lib/clientDayCache";

type RelatedItem = {
  catalogId: string;
  catalogType?: "movie" | "tv" | string | null;
  anilistId: number | null;
  malId?: number;
  malKind?: "anime" | "movie";
  title: string;
  year: string;
  posterPath: string;
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
  runtimeSeconds?: number | null;
  seasonAmount?: number;
  numberOfEpisodes?: number | null;
};

type RailsPayload = {
  related: RelatedItem[];
  youMightLike: YmlItem[];
};

const CACHE_PREFIX = "teavie.cache.anime-show-rails.v1:";

async function fetchAnimeShowRails(
  idMal: number,
  maxItems: number
): Promise<RailsPayload> {
  const cacheKey = `${CACHE_PREFIX}${idMal}:${maxItems}`;
  const cached = readClientDayCache<RailsPayload>(cacheKey);
  if (cached) return cached;

  const qs = new URLSearchParams({
    idMal: String(idMal),
    limit: String(maxItems),
  });
  const res = await fetch(`/api/anilist/show-rails?${qs.toString()}`);
  const data = res.ok
    ? await res.json()
    : { related: [], youMightLike: [] };
  const payload: RailsPayload = {
    related: Array.isArray(data.related) ? data.related : [],
    youMightLike: Array.isArray(data.youMightLike) ? data.youMightLike : [],
  };
  writeClientDayCache(cacheKey, payload);
  return payload;
}

export default function AnimeShowRails({
  idMal,
}: {
  idMal: number;
}) {
  const [related, setRelated] = useState<RelatedItem[]>([]);
  const [youMightLike, setYouMightLike] = useState<YmlItem[]>([]);
  const { mode: cardLayout } = useCatalogCardStyle();
  const horizontal = cardLayout === "horizontal";
  const ymlMax = horizontal ? 8 : 14;

  useEffect(() => {
    let cancelled = false;
    void fetchAnimeShowRails(idMal, ymlMax).then((data) => {
      if (cancelled) return;
      setRelated(
        data.related.filter(
          (it) => typeof it.catalogId === "string" && it.catalogId.trim().length > 0
        )
      );
      setYouMightLike(data.youMightLike);
    });
    return () => {
      cancelled = true;
    };
  }, [idMal, ymlMax]);

  const gridClass = horizontal
    ? CATALOG_GRID_HORIZONTAL_SEARCH
    : CATALOG_GRID_VERTICAL_SEARCH;

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
                      backdropPath=""
                      topNote={item.topNote}
                    />
                  ) : (
                    <SmallCard
                      id={item.catalogId}
                      title={item.title}
                      year={item.year}
                      type={catalogKind}
                      seasonAmount={0}
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
                    backdropPath=""
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
