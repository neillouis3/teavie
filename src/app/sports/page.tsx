'use client';

import React, { useEffect } from 'react';
import Header from '@/components/ui/header';
import HorizontalSportsCard from '@/components/ui/horizontalSportsCard';
import VerticalSportsCard from '@/components/ui/verticalSportsCard';
import { useCatalogCardStyle } from '@/contexts/catalogCardStyleContext';
import { SPORTS_STREAMS } from '@/lib/sportsStreams';
import {
  CATALOG_GRID_HORIZONTAL,
  CATALOG_GRID_VERTICAL,
} from '@/lib/catalogGrid';

export default function SportsPage() {
  const { mode } = useCatalogCardStyle();
  const horizontal = mode === 'horizontal';

  useEffect(() => {
    document.title = 'Sports - Teavie';
  }, []);

  return (
    <div className="min-h-screen w-full bg-main">
      <Header pageName="Sports" />
      <div className="space-y-4 pr-3 pb-8 pt-2 sm:pr-4">
        <div className={horizontal ? CATALOG_GRID_HORIZONTAL : CATALOG_GRID_VERTICAL}>
          {SPORTS_STREAMS.map((s) =>
            horizontal ? (
              <HorizontalSportsCard
                key={s.slug}
                slug={s.slug}
                title={s.title}
                description={s.description}
                imageUrl={s.imageUrl}
              />
            ) : (
              <VerticalSportsCard
                key={s.slug}
                slug={s.slug}
                title={s.title}
                description={s.description}
                imageUrl={s.imageUrl}
              />
            )
          )}
        </div>
      </div>
    </div>
  );
}
