"use client";

import React from "react";
import CatalogContentRail from "@/components/explore/CatalogContentRail";
import type { ContentItem } from "@/types/content";

type WatchLaterRailProps = {
  items: ContentItem[];
  layout?: "explore" | "profile";
  maxItems?: number;
  className?: string;
};

export default function WatchLaterRail(props: WatchLaterRailProps) {
  return (
    <CatalogContentRail
      {...props}
      title="Watch later"
      ariaLabel="Watch later"
    />
  );
}
