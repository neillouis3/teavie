"use client";

import React from "react";
import SmallCard from "@/components/ui/smallCard";
import HorizontalCatalogCard from "@/components/ui/horizontalCatalogCard";
import SmallCardLoading from "@/components/ui/smallCardLoading";
import HorizontalCatalogCardLoading from "@/components/ui/horizontalCatalogCardLoading";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
} from "@/components/ui/carousel";
import {
  EXPLORE_RAIL_MAX_ITEMS,
  RAIL_CAROUSEL_ITEM_HORIZONTAL,
  RAIL_CAROUSEL_ITEM_VERTICAL,
  RAIL_INNER_CLASS,
  RAIL_TRACK,
  FLUSH_RAIL_TRACK,
  flushRailItemClass,
} from "@/lib/catalogGrid";
import { railContentItems } from "@/lib/dedupeContentItems";
import type { ContentItem } from "@/types/content";
import { useCatalogCardStyle } from "@/contexts/catalogCardStyleContext";
import { formatReleasePhrase } from "@/lib/formatRelease";
import ExploreSectionTitle from "@/components/explore/exploreSectionTitle";
import {
  CatalogRailShell,
  SIDEBAR_BLEED_CAROUSEL_OPTS,
  SidebarBleedStartSpacer,
  catalogRailViewportClass,
} from "@/components/ui/sidebarBleedRail";

type CatalogRailProps = {
  title: string;
  items: ContentItem[];
  /** @default 50 */
  maxItems?: number;
  /** Show “Released …” / “Releases …” under title on vertical cards */
  showReleaseNote?: boolean;
  loading?: boolean;
  /** Override default release note under card title. */
  getReleaseNote?: (item: ContentItem) => string | undefined;
  /** When set, replaces year/rating row (e.g. new episode chips). */
  getMetaChips?: (item: ContentItem) => string[] | undefined;
  titleVariant?: "default" | "explore";
  /** Hide the section icon (Explore hubs use plain text titles). */
  hideTitleIcon?: boolean;
  /** Edge-to-edge cards (category hub pages). */
  flush?: boolean;
};

function releaseNoteForItem(item: ContentItem): string | undefined {
  const rawDate = item.release_date ?? item.first_air_date ?? "";
  if (!rawDate || String(rawDate).length < 10) return undefined;
  return formatReleasePhrase(rawDate);
}

export function CatalogRailSkeleton({
  horizontal = false,
  count = 8,
  bleed = true,
  flush = false,
}: {
  horizontal?: boolean;
  count?: number;
  bleed?: boolean;
  flush?: boolean;
}) {
  const baseClass = horizontal ? RAIL_CAROUSEL_ITEM_HORIZONTAL : RAIL_CAROUSEL_ITEM_VERTICAL;
  const itemClass = flush ? flushRailItemClass(baseClass) : baseClass;
  const useBleed = bleed && !flush;
  return (
    <Carousel opts={SIDEBAR_BLEED_CAROUSEL_OPTS} className="w-full">
      <CarouselContent
        viewportClassName={
          flush ? "w-full overflow-hidden" : catalogRailViewportClass(useBleed)
        }
        className={flush ? FLUSH_RAIL_TRACK : RAIL_TRACK}
      >
        {useBleed ? <SidebarBleedStartSpacer /> : null}
        {Array.from({ length: count }).map((_, i) => (
          <CarouselItem key={i} className={itemClass}>
            {horizontal ? <HorizontalCatalogCardLoading /> : <SmallCardLoading />}
          </CarouselItem>
        ))}
      </CarouselContent>
    </Carousel>
  );
}

export default function CatalogRail({
  title,
  items,
  maxItems = EXPLORE_RAIL_MAX_ITEMS,
  showReleaseNote = false,
  getReleaseNote,
  getMetaChips,
  loading = false,
  titleVariant = "default",
  hideTitleIcon,
  flush = false,
}: CatalogRailProps) {
  const { mode } = useCatalogCardStyle();
  const horizontal = mode === "horizontal";
  const baseItemClass = horizontal ? RAIL_CAROUSEL_ITEM_HORIZONTAL : RAIL_CAROUSEL_ITEM_VERTICAL;
  const itemClass = flush ? flushRailItemClass(baseItemClass) : baseItemClass;

  const slice = railContentItems(items ?? [], maxItems);
  if (!loading && slice.length === 0) return null;

  return (
    <div className={RAIL_INNER_CLASS}>
      <ExploreSectionTitle
        variant={titleVariant}
        hideIcon={hideTitleIcon ?? titleVariant === "explore"}
      >
        {title}
      </ExploreSectionTitle>
      {loading ? (
        <CatalogRailShell bleed={!flush}>
          <CatalogRailSkeleton horizontal={horizontal} flush={flush} bleed={!flush} />
        </CatalogRailShell>
      ) : (
        <CatalogRailShell bleed={!flush}>
          <Carousel opts={SIDEBAR_BLEED_CAROUSEL_OPTS} className="w-full">
            <CarouselContent
              viewportClassName={
                flush ? "w-full overflow-hidden" : catalogRailViewportClass()
              }
              className={flush ? FLUSH_RAIL_TRACK : RAIL_TRACK}
            >
              {!flush ? <SidebarBleedStartSpacer /> : null}
              {slice.map((item) => {
                const titleText = item.title || item.name || "Untitled";
                const year =
                  item.release_date?.split("-")[0] ||
                  item.first_air_date?.split("-")[0] ||
                  "N/A";
                const metaChips = getMetaChips?.(item);
                const key = `${item.type ?? "x"}-${item.id}`;
                return (
                  <CarouselItem key={key} className={itemClass}>
                    {horizontal ? (
                      <HorizontalCatalogCard
                        id={item.id}
                        title={titleText}
                        year={year}
                        type={item.type || "movie"}
                        posterPath={item.poster_path || ""}
                        backdropPath={item.backdrop_path || ""}
                        topNote={metaChips?.join(" · ")}
                      />
                    ) : (
                      <SmallCard
                        id={item.id}
                        title={titleText}
                        year={year}
                        voteAverage={
                          metaChips?.length ? undefined : item.vote_average
                        }
                        releaseNote={
                          metaChips?.length
                            ? undefined
                            : getReleaseNote?.(item) ??
                              (showReleaseNote ? releaseNoteForItem(item) : undefined)
                        }
                        metaChips={metaChips}
                        type={item.type || "movie"}
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
        </CatalogRailShell>
      )}
    </div>
  );
}
