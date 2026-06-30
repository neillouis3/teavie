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

/** Full viewport width under the fixed sidebar (desktop). */
export const SIDEBAR_BLEED_SHELL =
  "w-full lg:relative lg:left-[calc(-1*var(--sidebar-w,16rem))] lg:w-[100vw]";

export const SIDEBAR_BLEED_CAROUSEL_OPTS = {
  align: "start" as const,
  dragFree: true,
};

/** Leading sidebar-width gap for native horizontal scroll tracks (desktop only). */
export const SIDEBAR_BLEED_NATIVE_START =
  "max-lg:hidden shrink-0 lg:w-[var(--sidebar-w,16rem)]";

const SCROLL_HIDE =
  "overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

/** Embla viewport: full-bleed shell; first slide is the sidebar-width offset. */
export function sidebarBleedViewportClass(
  ...extra: (string | false | null | undefined)[]
) {
  return cn(SIDEBAR_BLEED_SHELL, extra);
}

/** Desktop-only leading slide matching the sidebar width. */
export function SidebarBleedStartSpacer() {
  return (
    <CarouselItem
      aria-hidden
      className="max-lg:hidden shrink-0 grow-0 basis-[var(--sidebar-w,16rem)] pl-0"
    >
      <span className="sr-only">Sidebar offset</span>
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
