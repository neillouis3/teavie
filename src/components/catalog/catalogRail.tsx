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
import type { ContentItem } from "@/types/content";
import { useCatalogCardStyle } from "@/contexts/catalogCardStyleContext";
import { formatReleasePhrase } from "@/lib/formatRelease";
import ExploreSectionTitle from "@/components/explore/exploreSectionTitle";
import SidebarBleedRail, {
  SIDEBAR_BLEED_CAROUSEL_OPTS,
  SidebarBleedStartSpacer,
  sidebarBleedViewportClass,
} from "@/components/ui/sidebarBleedRail";

type CatalogRailProps = {
  title: string;
  items: ContentItem[];
  /** @default 24 */
  maxItems?: number;
  moreHref?: string;
  moreLabel?: string;
  /** Show “Released …” / “Releases …” under title on vertical cards */
  showReleaseNote?: boolean;
  loading?: boolean;
  titleVariant?: "default" | "explore";
};

const CAROUSEL_ITEM_VERTICAL =
  "basis-[45%] pl-3 sm:basis-[32%] md:basis-1/5 lg:basis-[14%] xl:basis-[12%]";
const CAROUSEL_ITEM_HORIZONTAL =
  "basis-[88%] pl-3 sm:basis-[55%] md:basis-[42%] lg:basis-1/3 xl:basis-1/4";

function releaseNoteForItem(item: ContentItem): string | undefined {
  const rawDate = item.release_date ?? item.first_air_date ?? "";
  if (!rawDate || String(rawDate).length < 10) return undefined;
  return formatReleasePhrase(rawDate);
}

export function CatalogRailSkeleton({
  horizontal = false,
  count = 8,
}: {
  horizontal?: boolean;
  count?: number;
}) {
  const itemClass = horizontal ? CAROUSEL_ITEM_HORIZONTAL : CAROUSEL_ITEM_VERTICAL;
  return (
    <Carousel opts={SIDEBAR_BLEED_CAROUSEL_OPTS} className="w-full">
      <CarouselContent
        viewportClassName={sidebarBleedViewportClass()}
        className="-ml-3"
      >
        <SidebarBleedStartSpacer />
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
  maxItems = 24,
  moreHref,
  moreLabel = "More",
  showReleaseNote = false,
  loading = false,
  titleVariant = "default",
}: CatalogRailProps) {
  const { mode } = useCatalogCardStyle();
  const horizontal = mode === "horizontal";
  const itemClass = horizontal ? CAROUSEL_ITEM_HORIZONTAL : CAROUSEL_ITEM_VERTICAL;

  const slice = (items ?? []).slice(0, maxItems);
  if (!loading && slice.length === 0) return null;

  return (
    <div className="flex w-full flex-col gap-3">
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
        <SidebarBleedRail>
          <CatalogRailSkeleton horizontal={horizontal} />
        </SidebarBleedRail>
      ) : (
        <SidebarBleedRail>
          <Carousel opts={SIDEBAR_BLEED_CAROUSEL_OPTS} className="w-full">
            <CarouselContent
              viewportClassName={sidebarBleedViewportClass()}
              className="-ml-3"
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
                        releaseNote={
                          showReleaseNote ? releaseNoteForItem(item) : undefined
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
        </SidebarBleedRail>
      )}
    </div>
  );
}
