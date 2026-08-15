"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import HorizontalCatalogCard from "@/components/ui/horizontalCatalogCard";
import SmallCard from "@/components/ui/smallCard";
import { useCatalogCardStyle } from "@/contexts/catalogCardStyleContext";
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
  DETAIL_RAIL_CAROUSEL_ITEM_VERTICAL,
  DETAIL_RAIL_MAX_ITEMS,
  DETAIL_RAIL_SECTION_CLASS,
  RAIL_CAROUSEL_ITEM_HORIZONTAL,
  RAIL_CAROUSEL_ITEM_VERTICAL,
  RAIL_TRACK,
} from "@/lib/catalogGrid";
import type { ContentItem } from "@/types/content";
import { readClientDayCache, writeClientDayCache } from "@/lib/clientDayCache";

const COLLECTION_CACHE_PREFIX = "teavie.cache.movie-collection.v1:";

type CollectionPayload = {
  collection: CollectionMeta | null;
  items: ContentItem[];
};

const collectionInflight = new Map<string, Promise<CollectionPayload>>();

type CollectionMeta = {
  id: number;
  name: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
};

type MovieCollectionRailProps = {
  movieId: string;
  bleed?: boolean;
};

function itemYear(item: ContentItem) {
  const raw = item.release_date ?? "";
  return raw.length >= 4 ? raw.slice(0, 4) : "—";
}

export default function MovieCollectionRail({
  movieId,
  bleed = false,
}: MovieCollectionRailProps) {
  const cacheKey = `${COLLECTION_CACHE_PREFIX}${movieId}`;

  const [collection, setCollection] = useState<CollectionMeta | null>(() => {
    if (typeof window === "undefined") return null;
    return readClientDayCache<CollectionPayload>(cacheKey)?.collection ?? null;
  });
  const [items, setItems] = useState<ContentItem[]>(() => {
    if (typeof window === "undefined") return [];
    return readClientDayCache<CollectionPayload>(cacheKey)?.items ?? [];
  });
  const [loading, setLoading] = useState(() => {
    if (typeof window === "undefined") return true;
    const cached = readClientDayCache<CollectionPayload>(cacheKey);
    return !(cached && cached.items.length > 0);
  });
  const { mode: cardLayout } = useCatalogCardStyle();
  const horizontal = cardLayout === "horizontal";
  const itemClass = horizontal
    ? RAIL_CAROUSEL_ITEM_HORIZONTAL
    : bleed
      ? RAIL_CAROUSEL_ITEM_VERTICAL
      : DETAIL_RAIL_CAROUSEL_ITEM_VERTICAL;
  const visibleItems = useMemo(
    () => (bleed ? items : items.slice(0, DETAIL_RAIL_MAX_ITEMS)),
    [bleed, items]
  );

  useEffect(() => {
    let cancelled = false;
    const cached = readClientDayCache<CollectionPayload>(cacheKey);

    if (cached?.items.length) {
      setCollection(cached.collection);
      setItems(cached.items);
      setLoading(false);
    } else {
      setCollection(null);
      setItems([]);
      setLoading(true);
    }

    const load = () => {
      const existing = collectionInflight.get(cacheKey);
      if (existing) return existing;

      const promise = fetch(
        `/api/movie/collection?movieId=${encodeURIComponent(movieId)}&limit=${DETAIL_RAIL_MAX_ITEMS}`
      )
        .then((res) =>
          res.ok ? res.json() : { collection: null, items: [] }
        )
        .then((data: CollectionPayload) => ({
          collection: data.collection ?? null,
          items: Array.isArray(data.items) ? data.items : [],
        }))
        .finally(() => {
          collectionInflight.delete(cacheKey);
        });

      collectionInflight.set(cacheKey, promise);
      return promise;
    };

    void load()
      .then((data) => {
        if (cancelled) return;
        setCollection(data.collection);
        setItems(data.items);
        if (data.items.length > 0) writeClientDayCache(cacheKey, data);
      })
      .catch(() => {
        if (cancelled) return;
        if (!cached?.items.length) {
          setCollection(null);
          setItems([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [cacheKey, movieId]);

  if (!loading && items.length === 0) return null;

  const title = collection?.name ?? "Collection";
  const viewAllHref = collection?.id
    ? `/collections/${collection.id}`
    : undefined;

  return (
    <section className={DETAIL_RAIL_SECTION_CLASS} aria-label={title}>
      <ExploreSectionTitle variant="explore" hideIcon>
        {title}
      </ExploreSectionTitle>
      <CatalogRailShell bleed={bleed}>
        {loading && items.length === 0 ? (
          <CatalogRailSkeleton
            count={DETAIL_RAIL_MAX_ITEMS}
            horizontal={horizontal}
            bleed={bleed}
            detail={!bleed}
          />
        ) : (
          <>
            <Carousel opts={SIDEBAR_BLEED_CAROUSEL_OPTS} className="w-full">
              <CarouselContent
                viewportClassName={catalogRailViewportClass(bleed)}
                className={RAIL_TRACK}
              >
                {bleed ? <SidebarBleedStartSpacer /> : null}
                {visibleItems.map((item) => (
                  <CarouselItem key={String(item.id)} className={itemClass}>
                    {horizontal ? (
                      <HorizontalCatalogCard
                        id={String(item.id)}
                        title={item.title ?? "Untitled"}
                        year={itemYear(item)}
                        posterPath={item.poster_path ?? ""}
                        backdropPath={item.backdrop_path ?? ""}
                        type="movie"
                      />
                    ) : (
                      <SmallCard
                        id={String(item.id)}
                        title={item.title ?? "Untitled"}
                        year={itemYear(item)}
                        posterPath={item.poster_path ?? ""}
                        runtimeSeconds={item.runtimeSeconds}
                        seasonAmount={0}
                        type="movie"
                      />
                    )}
                  </CarouselItem>
                ))}
              </CarouselContent>
            </Carousel>
            {viewAllHref && visibleItems.length > 0 ? (
              <p className="mt-2 text-right">
                <Link
                  href={viewAllHref}
                  className="text-sm text-success hover:underline"
                >
                  View full collection
                </Link>
              </p>
            ) : null}
          </>
        )}
      </CatalogRailShell>
    </section>
  );
}
