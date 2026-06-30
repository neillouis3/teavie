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

/** Embla opts: allow slides to scroll into the leading sidebar gutter. */
export const SIDEBAR_BLEED_CAROUSEL_OPTS = {
  align: "start" as const,
  dragFree: true,
  containScroll: false as const,
};

/**
 * Trailing pad on the Embla flex track so the last slide can scroll flush right.
 * Must not share the same element as SIDEBAR_BLEED_TRACK_INSET — combined they
 * exceed the viewport width and collapse the rail.
 */
export const SIDEBAR_BLEED_END_PAD_VERTICAL =
  "pr-[calc(100%_-_45%_-_0.75rem)] sm:pr-[calc(100%_-_32%_-_0.75rem)] md:pr-[calc(100%_-_20%_-_0.75rem)] lg:pr-[calc(100%_-_14%_-_0.75rem)] xl:pr-[calc(100%_-_12%_-_0.75rem)]";

export const SIDEBAR_BLEED_END_PAD_HORIZONTAL =
  "pr-[calc(100%_-_88%_-_0.75rem)] sm:pr-[calc(100%_-_55%_-_0.75rem)] md:pr-[calc(100%_-_42%_-_0.75rem)] lg:pr-[calc(100%_-_33.333%_-_0.75rem)] xl:pr-[calc(100%_-_25%_-_0.75rem)]";

export const SIDEBAR_BLEED_END_PAD_GENRE =
  "pr-[calc(100%_-_42%_-_0.75rem)] sm:pr-[calc(100%_-_30%_-_0.75rem)] md:pr-[calc(100%_-_25%_-_0.75rem)] lg:pr-[calc(100%_-_20%_-_0.75rem)] xl:pr-[calc(100%_-_16.667%_-_0.75rem)]";

export const SIDEBAR_BLEED_END_PAD_UPCOMING =
  "pr-[calc(100%_-_88%_-_0.75rem)] sm:pr-[calc(100%_-_66.667%_-_1rem)]";

const SCROLL_HIDE =
  "overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

type ClassValue = string | false | null | undefined;

/** Embla viewport: bleed shell + left inset (kept separate from end pad on the track). */
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
