"use client";

import React, { useEffect, useState } from "react";
import AnimeArtworkScroll from "@/components/animeArtworkScroll";
import HorizontalCatalogCard from "@/components/ui/horizontalCatalogCard";
import SmallCard from "@/components/ui/smallCard";
import { useCatalogCardStyle } from "@/contexts/catalogCardStyleContext";
import {
  CATALOG_GRID_HORIZONTAL_SEARCH,
  CATALOG_GRID_VERTICAL_SEARCH,
  EXPLORE_RAIL_MAX_ITEMS,
  RAIL_CAROUSEL_ITEM_VERTICAL,
} from "@/lib/catalogGrid";
import ExploreSectionTitle from "@/components/explore/exploreSectionTitle";
import {
  CatalogRailShell,
  SIDEBAR_BLEED_CAROUSEL_OPTS,
  SidebarBleedStartSpacer,
  catalogRailViewportClass,
} from "@/components/ui/sidebarBleedRail";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
} from "@/components/ui/carousel";
import { CatalogRailSkeleton } from "@/components/catalog/catalogRail";
import {
  clearLegacyAnimeShowRailsCache,
  readClientDayCache,
  writeClientDayCache,
} from "@/lib/clientDayCache";

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

const RELATED_CACHE_PREFIX = "teavie.cache.anime-related.v1:";
const YML_CACHE_PREFIX = "teavie.cache.anime-yml.v1:";

const CAROUSEL_ITEM_HORIZONTAL =
  "basis-[88%] pl-3 sm:basis-[55%] md:basis-[42%] lg:basis-1/3 xl:basis-1/4";

async function fetchRelatedAnime(
  idMal: number,
  includeChain: boolean
): Promise<RelatedItem[]> {
  const qs = new URLSearchParams({ idMal: String(idMal) });
  if (!includeChain) qs.set("chain", "0");
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
  bleed = true,
}: {
  idMal: number;
  /** Extend carousel under the sidebar (Explore). Detail pages should pass false. */
  bleed?: boolean;
}) {
  const [related, setRelated] = useState<RelatedItem[]>([]);
  const [youMightLike, setYouMightLike] = useState<YmlItem[]>([]);
  const [relatedLoading, setRelatedLoading] = useState(true);
  const [ymlLoading, setYmlLoading] = useState(true);
  const { mode: cardLayout } = useCatalogCardStyle();
  const horizontal = cardLayout === "horizontal";
  const ymlMax = horizontal ? 8 : EXPLORE_RAIL_MAX_ITEMS;

  useEffect(() => {
    clearLegacyAnimeShowRailsCache();
  }, []);

  useEffect(() => {
    let cancelled = false;
    const relatedCacheKey = `${RELATED_CACHE_PREFIX}${idMal}`;
    const ymlCacheKey = `${YML_CACHE_PREFIX}${idMal}:${ymlMax}`;

    const cachedRelated = readClientDayCache<RelatedItem[]>(relatedCacheKey);
    const cachedYml = readClientDayCache<YmlItem[]>(ymlCacheKey);

    if (cachedRelated?.length) {
      setRelated(cachedRelated);
      setRelatedLoading(false);
    } else {
      setRelated([]);
      setRelatedLoading(true);
    }

    if (cachedYml?.length) {
      setYouMightLike(cachedYml);
      setYmlLoading(false);
    } else {
      setYouMightLike([]);
      setYmlLoading(true);
    }

    void fetchYouMightLike(idMal, ymlMax)
      .then((items) => {
        if (cancelled) return;
        setYouMightLike(items);
        if (items.length > 0) writeClientDayCache(ymlCacheKey, items);
      })
      .catch(() => {
        if (cancelled) return;
        setYouMightLike([]);
      })
      .finally(() => {
        if (!cancelled) setYmlLoading(false);
      });

    if (cachedRelated?.length) {
      void fetchRelatedAnime(idMal, true)
        .then((items) => {
          if (cancelled || items.length === 0) return;
          setRelated(items);
          writeClientDayCache(relatedCacheKey, items);
        })
        .catch(() => {});
      return () => {
        cancelled = true;
      };
    }

    void fetchRelatedAnime(idMal, false)
      .then((fastItems) => {
        if (cancelled) return;
        if (fastItems.length > 0) setRelated(fastItems);
      })
      .catch(() => {});

    void fetchRelatedAnime(idMal, true)
      .then((items) => {
        if (cancelled) return;
        setRelated(items);
        if (items.length > 0) writeClientDayCache(relatedCacheKey, items);
      })
      .catch(() => {
        if (cancelled) return;
        setRelated([]);
      })
      .finally(() => {
        if (!cancelled) setRelatedLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [idMal, ymlMax]);

  const gridClass = horizontal
    ? CATALOG_GRID_HORIZONTAL_SEARCH
    : CATALOG_GRID_VERTICAL_SEARCH;

  const showRelated = related.length > 0 || relatedLoading;
  const showYml = youMightLike.length > 0 || ymlLoading;

  return (
    <>
      {showRelated ? (
        <section className="w-full pt-6">
          <ExploreSectionTitle className="mb-3">Related anime</ExploreSectionTitle>
          {related.length > 0 ? (
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
          ) : (
            <div className="flex gap-3 overflow-hidden opacity-60">
              {Array.from({ length: horizontal ? 4 : 6 }).map((_, i) => (
                <div
                  key={i}
                  className={`shrink-0 animate-pulse rounded-lg bg-muted ${
                    horizontal ? "h-24 w-44" : "h-52 w-36"
                  }`}
                />
              ))}
            </div>
          )}
        </section>
      ) : null}

      {showYml ? (
        <section
          className={`flex w-full flex-col gap-3 ${
            related.length > 0 || relatedLoading ? "mt-10 pt-8" : "pt-6"
          }`}
          aria-label="You might like"
        >
          <ExploreSectionTitle variant="explore">You might like</ExploreSectionTitle>
          {youMightLike.length > 0 ? (
            <CatalogRailShell bleed={bleed}>
              <Carousel opts={SIDEBAR_BLEED_CAROUSEL_OPTS} className="w-full">
                <CarouselContent
                  viewportClassName={catalogRailViewportClass(bleed)}
                  className="-ml-3"
                >
                  {bleed ? <SidebarBleedStartSpacer /> : null}
                  {youMightLike.map((item) => (
                    <CarouselItem
                      key={`${item.catalogId}-${item.malId ?? "na"}`}
                      className={horizontal ? CAROUSEL_ITEM_HORIZONTAL : RAIL_CAROUSEL_ITEM_VERTICAL}
                    >
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
                    </CarouselItem>
                  ))}
                </CarouselContent>
              </Carousel>
            </CatalogRailShell>
          ) : (
            <CatalogRailShell bleed={bleed}>
              <CatalogRailSkeleton horizontal={horizontal} bleed={bleed} />
            </CatalogRailShell>
          )}
        </section>
      ) : null}

      <AnimeArtworkScroll idMal={idMal} />
    </>
  );
}
