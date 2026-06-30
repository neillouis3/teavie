"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { CarouselItem } from "@/components/ui/carousel";

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

/** vw-based trailing spacer widths (desktop) — avoids flex-track % padding that collapses slides. */
export const SIDEBAR_BLEED_END_SPACER_VERTICAL =
  "max-lg:hidden lg:w-[calc((100vw-var(--sidebar-w,16rem))*0.86-0.75rem)] xl:w-[calc((100vw-var(--sidebar-w,16rem))*0.88-0.75rem)]";

export const SIDEBAR_BLEED_END_SPACER_HORIZONTAL =
  "max-lg:hidden lg:w-[calc((100vw-var(--sidebar-w,16rem))*0.667-0.75rem)] xl:w-[calc((100vw-var(--sidebar-w,16rem))*0.75-0.75rem)]";

export const SIDEBAR_BLEED_END_SPACER_GENRE =
  "max-lg:hidden lg:w-[calc((100vw-var(--sidebar-w,16rem))*0.8-0.75rem)] xl:w-[calc((100vw-var(--sidebar-w,16rem))*0.833-0.75rem)]";

export const SIDEBAR_BLEED_END_SPACER_UPCOMING =
  "max-lg:hidden lg:w-[calc((100vw-var(--sidebar-w,16rem))*0.333-1rem)]";

const SCROLL_HIDE =
  "overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

type ClassValue = string | false | null | undefined;

/** Embla viewport: bleed shell + left inset (kept separate from end spacer on the track). */
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

/** Trailing slide so the last item can scroll flush to the viewport's right edge on desktop. */
export function SidebarBleedEndSpacer({ widthClass }: { widthClass: string }) {
  return (
    <CarouselItem
      aria-hidden
      className="pointer-events-none min-w-0 shrink-0 grow-0 basis-auto pl-0 max-lg:hidden"
    >
      <div className={cn("h-px shrink-0", widthClass)} />
    </CarouselItem>
  );
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
