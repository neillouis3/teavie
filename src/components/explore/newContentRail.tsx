'use client';

import React from "react";
import { cn } from "@/lib/utils";
import SmallCard from "@/components/ui/smallCard";
import {
  SIDEBAR_BLEED_SHELL,
  SidebarBleedNativeStart,
} from "@/components/ui/sidebarBleedRail";
import type { ContentItem } from "@/types/content";

const ROW_COUNT = 7;

const SCROLL_HIDE =
  "overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

type NewContentRailProps = {
  items: ContentItem[];
};

export default function NewContentRail({ items }: NewContentRailProps) {
  const row = items.slice(0, ROW_COUNT);
  if (row.length === 0) return null;

  return (
    <div
      className={cn(
        SIDEBAR_BLEED_SHELL,
        SCROLL_HIDE,
        "lg:overflow-x-visible"
      )}
    >
      <div className="flex w-full min-w-0">
        <SidebarBleedNativeStart />
        <div className="grid min-w-[36rem] flex-1 grid-cols-7 gap-1.5 sm:min-w-0 sm:gap-2 md:gap-3 lg:min-w-0">
          {row.map((item) => {
            const title = item.title || item.name || "Untitled";
            const rawDate = item.release_date ?? item.first_air_date ?? "";
            const year = rawDate?.split("-")[0] || "N/A";

            return (
              <SmallCard
                key={`${item.type ?? "x"}-${item.id}`}
                id={item.id}
                title={title}
                year={year}
                type={item.type || "movie"}
                runtimeSeconds={item.runtimeSeconds ?? undefined}
                seasonAmount={item.season_amount ?? 0}
                numberOfEpisodes={item.number_of_episodes ?? undefined}
                posterPath={item.poster_path || ""}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
