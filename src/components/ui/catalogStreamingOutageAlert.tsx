"use client";

import React from "react";
import { usePathname } from "next/navigation";
import { Alert } from "@heroui/react";
import {
  CATALOG_STREAMING_OUTAGE_ACTIVE,
  pathShowsCatalogStreamingOutage,
} from "@/lib/streamingOutage";
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
      description="Movie and TV show playback is temporarily unavailable because our streaming servers are currently down. Anime continues to play normally. We apologize for the inconvenience and appreciate your patience."
      className={cn("w-full", className)}
    />
  );
}

/** Site-wide banner for catalog routes (excludes anime and sports). */
export function CatalogStreamingOutageBanner() {
  const pathname = usePathname() ?? "";
  const heroBleed =
    pathname === "/explore" || /^\/shows\/([^/]+)\/?$/.test(pathname);

  if (!pathShowsCatalogStreamingOutage(pathname)) return null;

  return (
    <div
      className={cn(
        "relative z-30 w-full px-3 sm:px-4 lg:px-6",
        heroBleed ? "pt-14" : "pt-3"
      )}
    >
      <CatalogStreamingOutageAlert />
    </div>
  );
}
