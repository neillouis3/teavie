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

/** Leading sidebar-width gap for native horizontal scroll tracks (desktop only). */
export const SIDEBAR_BLEED_NATIVE_START =
  "hidden shrink-0 max-lg:hidden lg:block lg:w-[var(--sidebar-w,16rem)]";

/** Embla opts — allow scrolling into the leading sidebar gutter. */
export const SIDEBAR_BLEED_CAROUSEL_OPTS = {
  align: "start" as const,
  dragFree: true,
  containScroll: false as const,
};

/** vw-based trailing spacer (desktop) so the last slide can sit on the right edge. */
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

/** Embla viewport: full-bleed shell only (inset via start spacer slide). */
export function sidebarBleedViewportClass(...extra: ClassValue[]) {
  return cn(SIDEBAR_BLEED_SHELL, extra);
}

/** Slide gutter classes on the Embla flex track. */
export function sidebarBleedTrackClass(...extra: ClassValue[]) {
  return cn(...extra);
}

/** Desktop-only leading gap matching the sidebar width. */
export function SidebarBleedStartSpacer() {
  return (
    <CarouselItem
      aria-hidden
      className="pointer-events-none min-w-0 shrink-0 grow-0 basis-auto pl-0 max-lg:hidden"
    >
      <div className="h-px w-[var(--sidebar-w,16rem)] shrink-0" />
    </CarouselItem>
  );
}

/** Desktop-only trailing gap so the row stays full at the scroll end. */
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
