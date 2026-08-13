"use client";

import React from "react";
import CatalogContentRail from "@/components/explore/CatalogContentRail";
import type { ContentItem } from "@/types/content";

type FavoritesRailProps = {
  items: ContentItem[];
  layout?: "explore" | "profile";
  bleed?: boolean;
  display?: "rail" | "grid";
  maxItems?: number;
  className?: string;
  sectionTitleClassName?: string;
};

export default function FavoritesRail(props: FavoritesRailProps) {
  return (
    <CatalogContentRail
      {...props}
      title="Favorites"
      ariaLabel="Favorites"
      showVoteAverage
    />
  );
}
