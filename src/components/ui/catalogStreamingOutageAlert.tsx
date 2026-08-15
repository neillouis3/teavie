"use client";

import React from "react";
import { usePathname } from "next/navigation";
import { Alert } from "@heroui/react";
import {
  CATALOG_STREAMING_OUTAGE_ACTIVE,
  pathShowsCatalogStreamingOutage,
} from "@/lib/streamingOutage";
import { pathUsesHeroBleed } from "@/lib/heroBleedPaths";
import { CONTENT_INSET_X } from "@/lib/contentInset";
import { NAV_HERO_CLEARANCE } from "@/lib/navLayout";
import { cn } from "@/lib/utils";

type CatalogStreamingOutageAlertProps = {
  className?: string;
};

export default function CatalogStreamingOutageAlert({
  className,
}: CatalogStreamingOutageAlertProps) {
  if (!CATALOG_STREAMING_OUTAGE_ACTIVE) return null;

  return (
    <Alert
      color="warning"
      variant="flat"
      title="Streaming service notice"
      description="Movie and TV show playback is temporarily unavailable because global streaming servers are currently down. Anime continues to play normally. We are working to find the problem and apologize for the inconvenience."
      className={cn("w-full", className)}
    />
  );
}

/** Site-wide banner for catalog routes (excludes anime and sports). */
export function CatalogStreamingOutageBanner() {
  const pathname = usePathname() ?? "";
  const heroBleed = pathUsesHeroBleed(pathname);

  if (!pathShowsCatalogStreamingOutage(pathname)) return null;

  return (
    <div
      className={cn(
        "relative z-30",
        CONTENT_INSET_X,
        heroBleed ? NAV_HERO_CLEARANCE : "pt-3"
      )}
    >
      <CatalogStreamingOutageAlert className="rounded-none" />
    </div>
  );
}
