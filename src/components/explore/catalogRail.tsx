"use client";

import React from "react";
import Link from "next/link";
import { Chip } from "@heroui/react";
import SmallCard from "@/components/ui/smallCard";
import HorizontalCatalogCard from "@/components/ui/horizontalCatalogCard";
import type { ContentItem } from "@/types/content";
import { useCatalogCardStyle } from "@/contexts/catalogCardStyleContext";

type CatalogRailProps = {
  title: string;
  items: ContentItem[];
  /** @default 12 */
  maxItems?: number;
  moreHref?: string;
  moreLabel?: string;
};

export default function CatalogRail({
  title,
  items,
  maxItems = 12,
  moreHref,
  moreLabel = "More",
}: CatalogRailProps) {
  const { mode } = useCatalogCardStyle();
  const horizontal = mode === "horizontal";

  const slice = (items ?? []).slice(0, maxItems);
  if (slice.length === 0) return null;

  /** `items-start`: avoid stretch-tall rows (one long title was adding empty space under every card). */
  const railClass =
    "grid w-full grid-flow-col grid-rows-2 auto-rows-min items-start content-start gap-x-3 gap-y-2 overflow-x-auto pb-2 pr-2 [scrollbar-width:thin]";

  return (
    <div className="flex w-full flex-col gap-3">
      <div className="flex flex-row flex-wrap items-center justify-between gap-2">
        <Chip color="success" variant="flat" size="md" radius="sm">
          {title}
        </Chip>
        {moreHref ? (
          <Link
            href={moreHref}
            className="text-xs text-success underline underline-offset-2 hover:opacity-80"
          >
            {moreLabel}
          </Link>
        ) : null}
      </div>
      <div className={railClass}>
        {slice.map((item) => {
          const titleText = item.title || item.name || "Untitled";
          const year =
            item.release_date?.split("-")[0] ||
            item.first_air_date?.split("-")[0] ||
            "N/A";
          const key = `${item.type ?? "x"}-${item.id}`;
          const wrapClass = horizontal
            ? "w-[240px] sm:w-[280px] md:w-[320px] lg:w-[340px]"
            : "w-[120px] sm:w-[145px] md:w-[160px] lg:w-[175px]";
          return (
            <div key={key} className={wrapClass}>
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
                  type={item.type || "movie"}
                  runtimeSeconds={item.runtimeSeconds ?? undefined}
                  seasonAmount={item.season_amount ?? 0}
                  numberOfEpisodes={item.number_of_episodes ?? undefined}
                  posterPath={item.poster_path || ""}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
