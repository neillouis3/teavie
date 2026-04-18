import React from "react";
import Link from "next/link";
import { Chip } from "@heroui/react";
import SmallCard from "@/components/ui/smallCard";
import type { ContentItem } from "@/types/content";

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
  const slice = (items ?? []).slice(0, maxItems);
  if (slice.length === 0) return null;

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
      <div className="grid w-full grid-cols-3 gap-2 sm:gap-4 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-6">
        {slice.map((item) => {
          const titleText = item.title || item.name || "Untitled";
          const year =
            item.release_date?.split("-")[0] ||
            item.first_air_date?.split("-")[0] ||
            "N/A";
          const key = `${item.type ?? "x"}-${item.id}`;
          return (
            <SmallCard
              key={key}
              id={item.id}
              title={titleText}
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
  );
}
