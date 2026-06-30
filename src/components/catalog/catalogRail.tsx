"use client";

import React from "react";
import Link from "next/link";
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
import type { ContentItem } from "@/types/content";
import { useCatalogCardStyle } from "@/contexts/catalogCardStyleContext";
import { formatReleasePhrase } from "@/lib/formatRelease";
import ExploreSectionTitle from "@/components/explore/exploreSectionTitle";

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
  /** Plain section title (Explore) vs success chip (default). */
  sectionTitleStyle?: "chip" | "text";
  /** Align the rail carousel to the page’s left edge. */
  flushLeft?: boolean;
};

const CAROUSEL_ITEM_VERTICAL =
  "basis-[45%] pl-3 sm:basis-[32%] md:basis-1/5 lg:basis-[14%] xl:basis-[12%]";
const CAROUSEL_ITEM_HORIZONTAL =
  "basis-[88%] pl-3 sm:basis-[55%] md:basis-[42%] lg:basis-1/3 xl:basis-1/4";

const CAROUSEL_ITEM_VERTICAL_FLUSH =
  "basis-[45%] pl-0 sm:basis-[32%] md:basis-1/5 lg:basis-[14%] xl:basis-[12%]";
const CAROUSEL_ITEM_HORIZONTAL_FLUSH =
  "basis-[88%] pl-0 sm:basis-[55%] md:basis-[42%] lg:basis-1/3 xl:basis-1/4";

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
    <Carousel opts={{ align: "start", dragFree: true }} className="w-full">
      <CarouselContent className="-ml-3">
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
  sectionTitleStyle = "chip",
  flushLeft = false,
}: CatalogRailProps) {
  const { mode } = useCatalogCardStyle();
  const horizontal = mode === "horizontal";
  const itemClass = horizontal
    ? flushLeft
      ? CAROUSEL_ITEM_HORIZONTAL_FLUSH
      : CAROUSEL_ITEM_HORIZONTAL
    : flushLeft
      ? CAROUSEL_ITEM_VERTICAL_FLUSH
      : CAROUSEL_ITEM_VERTICAL;
  const contentOffsetClass = flushLeft ? "ml-0" : "-ml-3";

  const slice = (items ?? []).slice(0, maxItems);
  if (!loading && slice.length === 0) return null;

  return (
    <div className="flex w-full flex-col gap-3">
      <div className="flex flex-row flex-wrap items-center justify-between gap-2">
        {sectionTitleStyle === "text" ? (
          <ExploreSectionTitle>{title}</ExploreSectionTitle>
        ) : (
          <Chip color="success" variant="flat" size="md" radius="sm">
            {title}
          </Chip>
        )}
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
        <CatalogRailSkeleton horizontal={horizontal} />
      ) : (
        <Carousel opts={{ align: "start", dragFree: true }} className="w-full">
          <CarouselContent className={contentOffsetClass}>
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
      )}
    </div>
  );
}
