'use client';

import React, { useMemo } from 'react';
import SmallCard from '@/components/ui/smallCard';
import SidebarBleedRail, {
  SIDEBAR_BLEED_CAROUSEL_OPTS,
  SidebarBleedStartSpacer,
  sidebarBleedViewportClass,
} from '@/components/ui/sidebarBleedRail';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
} from '@/components/ui/carousel';
import {
  NEW_ON_TEAVIE_MAX_ITEMS,
  RAIL_CAROUSEL_ITEM_VERTICAL,
} from '@/lib/catalogGrid';
import { railContentItems } from '@/lib/dedupeContentItems';
import type { ContentItem } from '@/types/content';

type NewContentRailProps = {
  items: ContentItem[];
  maxItems?: number;
};

export default function NewContentRail({
  items,
  maxItems = NEW_ON_TEAVIE_MAX_ITEMS,
}: NewContentRailProps) {
  const visibleItems = useMemo(
    () => railContentItems(items, maxItems),
    [items, maxItems]
  );

  if (visibleItems.length === 0) return null;

  return (
    <SidebarBleedRail>
      <Carousel opts={SIDEBAR_BLEED_CAROUSEL_OPTS} className="w-full">
        <CarouselContent
          viewportClassName={sidebarBleedViewportClass()}
          className="-ml-3"
        >
          <SidebarBleedStartSpacer />
          {visibleItems.map((item) => {
            const title = item.title || item.name || 'Untitled';
            const rawDate = item.release_date ?? item.first_air_date ?? '';
            const year = rawDate?.split('-')[0] || 'N/A';

            return (
              <CarouselItem
                key={`${item.type ?? 'x'}-${item.id}`}
                className={RAIL_CAROUSEL_ITEM_VERTICAL}
              >
                <SmallCard
                  id={item.id}
                  title={title}
                  year={year}
                  type={item.type || 'movie'}
                  runtimeSeconds={item.runtimeSeconds ?? undefined}
                  seasonAmount={item.season_amount ?? 0}
                  numberOfEpisodes={item.number_of_episodes ?? undefined}
                  posterPath={item.poster_path || ''}
                />
              </CarouselItem>
            );
          })}
        </CarouselContent>
      </Carousel>
    </SidebarBleedRail>
  );
}
