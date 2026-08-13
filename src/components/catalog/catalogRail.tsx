"use client";

import React from "react";
import Link from "next/link";
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
  moreHref?: string;
  moreLabel?: string;
  /** Show “Released …” / “Releases …” under title on vertical cards */
  showReleaseNote?: boolean;
  loading?: boolean;
  /** Override default release note under card title. */
  getReleaseNote?: (item: ContentItem) => string | undefined;
  titleVariant?: "default" | "explore";
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
}: {
  horizontal?: boolean;
  count?: number;
  bleed?: boolean;
}) {
  const itemClass = horizontal ? RAIL_CAROUSEL_ITEM_HORIZONTAL : RAIL_CAROUSEL_ITEM_VERTICAL;
  return (
    <Carousel opts={SIDEBAR_BLEED_CAROUSEL_OPTS} className="w-full">
      <CarouselContent
        viewportClassName={catalogRailViewportClass(bleed)}
        className={RAIL_TRACK}
      >
        {bleed ? <SidebarBleedStartSpacer /> : null}
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
  moreHref,
  moreLabel = "More",
  showReleaseNote = false,
  getReleaseNote,
  loading = false,
  titleVariant = "default",
}: CatalogRailProps) {
  const { mode } = useCatalogCardStyle();
  const horizontal = mode === "horizontal";
  const itemClass = horizontal ? RAIL_CAROUSEL_ITEM_HORIZONTAL : RAIL_CAROUSEL_ITEM_VERTICAL;

  const slice = railContentItems(items ?? [], maxItems);
  if (!loading && slice.length === 0) return null;

  return (
    <div className={RAIL_INNER_CLASS}>
      <div className="flex flex-row flex-wrap items-center justify-between gap-2">
        <ExploreSectionTitle variant={titleVariant}>{title}</ExploreSectionTitle>
        {moreHref ? (
          <Link
            href={moreHref}
            className="text-xs text-success underline underline-offset-2 hover:opacity-80"
          >
            {moreLabel}
          </Link>
        ) : null}
      </div>
      {loading ? (
        <CatalogRailShell>
          <CatalogRailSkeleton horizontal={horizontal} />
        </CatalogRailShell>
      ) : (
        <CatalogRailShell>
          <Carousel opts={SIDEBAR_BLEED_CAROUSEL_OPTS} className="w-full">
            <CarouselContent
              viewportClassName={catalogRailViewportClass()}
              className={RAIL_TRACK}
            >
              <SidebarBleedStartSpacer />
              {slice.map((item) => {
                const titleText = item.title || item.name || "Untitled";
                const year =
                  item.release_date?.split("-")[0] ||
                  item.first_air_date?.split("-")[0] ||
                  "N/A";
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
                      />
                    ) : (
                      <SmallCard
                        id={item.id}
                        title={titleText}
                        year={year}
                        voteAverage={item.vote_average}
                        releaseNote={
                          getReleaseNote?.(item) ??
                          (showReleaseNote ? releaseNoteForItem(item) : undefined)
                        }
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
