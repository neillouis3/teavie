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

/** Left inset on scroll tracks so the first card aligns with page content. */
export const SIDEBAR_BLEED_TRACK_INSET =
  "box-border lg:pl-[var(--sidebar-w,16rem)]";

/** Embla opts: allow slides to scroll into the leading sidebar gutter. */
export const SIDEBAR_BLEED_CAROUSEL_OPTS = {
  align: "start" as const,
  dragFree: true,
  containScroll: false as const,
};

/** Trailing pad so the last slide can scroll flush to the viewport's right edge. */
export const SIDEBAR_BLEED_END_PAD_VERTICAL =
  "pr-[calc(100%-45%-0.75rem)] sm:pr-[calc(100%-32%-0.75rem)] md:pr-[calc(100%-20%-0.75rem)] lg:pr-[calc(100%-14%-0.75rem)] xl:pr-[calc(100%-12%-0.75rem)]";

export const SIDEBAR_BLEED_END_PAD_HORIZONTAL =
  "pr-[calc(100%-88%-0.75rem)] sm:pr-[calc(100%-55%-0.75rem)] md:pr-[calc(100%-42%-0.75rem)] lg:pr-[calc(100%-33.333%-0.75rem)] xl:pr-[calc(100%-25%-0.75rem)]";

export const SIDEBAR_BLEED_END_PAD_GENRE =
  "pr-[calc(100%-42%-0.75rem)] sm:pr-[calc(100%-30%-0.75rem)] md:pr-[calc(100%-25%-0.75rem)] lg:pr-[calc(100%-20%-0.75rem)] xl:pr-[calc(100%-16.667%-0.75rem)]";

export const SIDEBAR_BLEED_END_PAD_UPCOMING =
  "pr-[calc(100%-88%-0.75rem)] sm:pr-[calc(100%-66.666%-1rem)]";

const SCROLL_HIDE =
  "overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

type ClassValue = string | false | null | undefined;

/** Embla viewport: full-bleed shell only (inset lives on the flex track). */
export function sidebarBleedViewportClass(...extra: ClassValue[]) {
  return cn(SIDEBAR_BLEED_SHELL, extra);
}

/** Slide gutter + sidebar/track inset on the Embla flex row. */
export function sidebarBleedTrackClass(...extra: ClassValue[]) {
  return cn(SIDEBAR_BLEED_TRACK_INSET, ...extra);
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
