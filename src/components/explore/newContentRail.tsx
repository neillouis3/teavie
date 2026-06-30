'use client';

import React from "react";
import SmallCard from "@/components/ui/smallCard";
import SidebarBleedRail, { SIDEBAR_BLEED_NATIVE_START } from "@/components/ui/sidebarBleedRail";
import type { ContentItem } from "@/types/content";

const ROW_COUNT = 7;

type NewContentRailProps = {
  items: ContentItem[];
};

export default function NewContentRail({ items }: NewContentRailProps) {
  const row = items.slice(0, ROW_COUNT);
  if (row.length === 0) return null;

  return (
    <SidebarBleedRail scrollable>
      <div className="flex w-max min-w-full">
        <div className={SIDEBAR_BLEED_NATIVE_START} aria-hidden />
        <div className="grid min-w-[36rem] grid-cols-7 gap-1.5 sm:min-w-0 sm:gap-2 md:gap-3">
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
    </SidebarBleedRail>
  );
}
