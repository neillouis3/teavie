"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Chip } from "@heroui/react";
import SmallCard from "@/components/ui/smallCard";
import HorizontalCatalogCard from "@/components/ui/horizontalCatalogCard";
import SmallCardLoading from "@/components/ui/smallCardLoading";
import HorizontalCatalogCardLoading from "@/components/ui/horizontalCatalogCardLoading";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
} from "@/components/ui/carousel";
import { useCatalogCardStyle } from "@/contexts/catalogCardStyleContext";
import type { ContentItem } from "@/types/content";
import {
  listWatchHistory,
  watchHistoryProgressLabel,
  WATCH_HISTORY_CHANGED_EVENT,
  type WatchHistoryEntry,
} from "@/lib/watchHistory";

const CAROUSEL_ITEM_VERTICAL =
  "basis-[45%] pl-3 sm:basis-[32%] md:basis-1/5 lg:basis-[14%] xl:basis-[12%]";
const CAROUSEL_ITEM_HORIZONTAL =
  "basis-[88%] pl-3 sm:basis-[55%] md:basis-[42%] lg:basis-1/3 xl:basis-1/4";

type HistoryRow = ContentItem & {
  progressLabel: string;
};

export default function WatchHistoryRail() {
  const { mode } = useCatalogCardStyle();
  const horizontal = mode === "horizontal";
  const itemClass = horizontal ? CAROUSEL_ITEM_HORIZONTAL : CAROUSEL_ITEM_VERTICAL;

  const [entries, setEntries] = useState<WatchHistoryEntry[]>([]);
  const [items, setItems] = useState<HistoryRow[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const history = listWatchHistory();
    setEntries(history);
    if (history.length === 0) {
      setItems([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/catalog/history", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          entries: history.map((e) => ({
            catalogId: e.catalogId,
            mediaType: e.mediaType,
          })),
        }),
      });
      const json = (await res.json()) as { items?: ContentItem[] };
      const byId = new Map(
        (json.items ?? []).map((item) => [String(item.id), item])
      );
      const rows: HistoryRow[] = [];
      for (const entry of history) {
        const item = byId.get(entry.catalogId);
        if (!item) continue;
        rows.push({
          ...item,
          id: entry.catalogId,
          progressLabel: watchHistoryProgressLabel(entry),
        });
      }
      setItems(rows);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const onChange = () => void refresh();
    window.addEventListener(WATCH_HISTORY_CHANGED_EVENT, onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener(WATCH_HISTORY_CHANGED_EVENT, onChange);
      window.removeEventListener("storage", onChange);
    };
  }, [refresh]);

  if (!loading && entries.length === 0) {
    return null;
  }

  if (!loading && items.length === 0) {
    return null;
  }

  return (
    <section className="mb-8 flex w-full flex-col gap-3" aria-label="Watch history">
      <Chip color="success" variant="flat" size="md" radius="sm">
        Continue watching
      </Chip>

      {loading ? (
        <Carousel opts={{ align: "start", dragFree: true }} className="w-full">
          <CarouselContent className="-ml-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <CarouselItem key={i} className={itemClass}>
                {horizontal ? <HorizontalCatalogCardLoading /> : <SmallCardLoading />}
              </CarouselItem>
            ))}
          </CarouselContent>
        </Carousel>
      ) : (
        <Carousel opts={{ align: "start", dragFree: true }} className="w-full">
          <CarouselContent className="-ml-3">
            {items.map((item) => {
              const titleText = item.title || item.name || "Untitled";
              const year =
                item.release_date?.split("-")[0] ||
                item.first_air_date?.split("-")[0] ||
                "—";
              const mediaType = item.type === "movie" ? "movie" : "tv";
              const key = `${mediaType}-${item.id}`;

              return (
                <CarouselItem key={key} className={itemClass}>
                  {horizontal ? (
                    <HorizontalCatalogCard
                      id={item.id}
                      title={titleText}
                      year={year}
                      type={mediaType}
                      posterPath={item.poster_path || ""}
                      backdropPath={item.backdrop_path || ""}
                    />
                  ) : (
                    <SmallCard
                      id={item.id}
                      title={titleText}
                      year={year}
                      releaseNote={item.progressLabel}
                      type={mediaType}
                      runtimeSeconds={item.runtimeSeconds ?? undefined}
                      seasonAmount={item.season_amount ?? 0}
                      numberOfEpisodes={item.number_of_episodes ?? undefined}
                      posterPath={item.poster_path || ""}
                    />
                  )}
                </CarouselItem>
              );
            })}
          </CarouselContent>
        </Carousel>
      )}
    </section>
  );
}
