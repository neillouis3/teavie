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
  RAIL_CAROUSEL_ITEM_HORIZONTAL,
  RAIL_CAROUSEL_ITEM_VERTICAL,
  RAIL_TRACK,
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
    } else {
      setRelated([]);
    }

    if (cachedYml?.length) {
      setYouMightLike(cachedYml);
    } else {
      setYouMightLike([]);
    }

    void fetchYouMightLike(idMal, ymlMax)
      .then((items) => {
        if (cancelled) return;
        if (items.length > 0) {
          setYouMightLike(items);
          writeClientDayCache(ymlCacheKey, items);
        }
      })
      .catch(() => {
        if (cancelled) return;
      });

    void (async () => {
      try {
        if (!cachedRelated?.length) {
          const fastItems = await fetchRelatedAnime(idMal, false);
          if (cancelled) return;
          if (fastItems.length > 0) {
            setRelated(fastItems);
            writeClientDayCache(relatedCacheKey, fastItems);
          }
        }

        const fullItems = await fetchRelatedAnime(idMal, true);
        if (cancelled) return;
        if (fullItems.length > 0) {
          setRelated(fullItems);
          writeClientDayCache(relatedCacheKey, fullItems);
        }
      } catch {
        if (cancelled) return;
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [idMal, ymlMax]);

  const gridClass = horizontal
    ? CATALOG_GRID_HORIZONTAL_SEARCH
    : CATALOG_GRID_VERTICAL_SEARCH;

  const showRelated = related.length > 0;
  const showYml = youMightLike.length > 0;

  return (
    <>
      {showRelated ? (
        <section className="w-full pt-6">
          <ExploreSectionTitle className="mb-3">Related anime</ExploreSectionTitle>
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

      {showYml ? (
        <section
          className={`flex w-full flex-col gap-3 ${
            related.length > 0 ? "mt-10 pt-8" : "pt-6"
          }`}
          aria-label="More like this"
        >
          <ExploreSectionTitle variant="explore" hideIcon>
            More like this
          </ExploreSectionTitle>
          <CatalogRailShell bleed={bleed}>
            <Carousel opts={SIDEBAR_BLEED_CAROUSEL_OPTS} className="w-full">
              <CarouselContent
                viewportClassName={catalogRailViewportClass(bleed)}
                className={RAIL_TRACK}
              >
                {bleed ? <SidebarBleedStartSpacer /> : null}
                {youMightLike.map((item) => (
                  <CarouselItem
                    key={`${item.catalogId}-${item.malId ?? "na"}`}
                    className={horizontal ? RAIL_CAROUSEL_ITEM_HORIZONTAL : RAIL_CAROUSEL_ITEM_VERTICAL}
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
        </section>
      ) : null}

      <AnimeArtworkScroll idMal={idMal} />
    </>
  );
}
