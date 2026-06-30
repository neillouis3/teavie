"use client";

import React from "react";
import { cn } from "@/lib/utils";

type SidebarBleedRailProps = {
  children: React.ReactNode;
  className?: string;
  /** Native horizontal scroll (e.g. grid rails) instead of Embla. */
  scrollable?: boolean;
};

/** Full-viewport-width bleed under the fixed sidebar (native scroll rails). */
export const SIDEBAR_BLEED_SHELL =
  "w-full lg:relative lg:left-[calc(-1*var(--sidebar-w,16rem))] lg:z-0 lg:w-screen lg:max-w-[100vw]";

/** Left inset on native scroll tracks so the first card aligns with page content. */
export const SIDEBAR_BLEED_TRACK_INSET =
  "box-border lg:pl-[var(--sidebar-w,16rem)]";

/** Embla opts for bleed rails (no trailing spacer — scroll ends at the last slide). */
export const SIDEBAR_BLEED_CAROUSEL_OPTS = {
  align: "start" as const,
  dragFree: true,
  containScroll: false as const,
};

const SCROLL_HIDE =
  "overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

type ClassValue = string | false | null | undefined;

/** Embla viewport: bleed shell + left inset. */
export function sidebarBleedViewportClass(...extra: ClassValue[]) {
  return cn(
    SIDEBAR_BLEED_SHELL,
    "lg:box-border lg:pl-[var(--sidebar-w,16rem)]",
    extra
  );
}

/** Slide gutter classes on the Embla flex track. */
export function sidebarBleedTrackClass(...extra: ClassValue[]) {
  return cn(...extra);
}

export default function SidebarBleedRail({
  children,
  className,
  scrollable = false,
}: SidebarBleedRailProps) {
  if (!scrollable) {
    return <>{children}</>;
  }

  return (
    <div className={cn(SIDEBAR_BLEED_SHELL, SCROLL_HIDE, className)}>
      {children}
    </div>
  );
}
