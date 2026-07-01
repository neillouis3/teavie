"use client";

import React, { useSyncExternalStore } from "react";
import { cn } from "@/lib/utils";
import { CarouselItem } from "@/components/ui/carousel";

type SidebarBleedRailProps = {
  children: React.ReactNode;
  className?: string;
  /** Native horizontal scroll (e.g. grid rails) instead of Embla. */
  scrollable?: boolean;
};

const LG_MEDIA = "(min-width: 1024px)";

function subscribeLgUp(onStoreChange: () => void) {
  const mq = window.matchMedia(LG_MEDIA);
  mq.addEventListener("change", onStoreChange);
  return () => mq.removeEventListener("change", onStoreChange);
}

function getLgUpSnapshot() {
  return window.matchMedia(LG_MEDIA).matches;
}

/** True when the fixed sidebar layout is active (lg+). */
export function useSidebarBleedOffset() {
  return useSyncExternalStore(subscribeLgUp, getLgUpSnapshot, () => false);
}

/** Keep sidebar-dependent layout in sync during collapse/expand. */
export const SIDEBAR_SYNC_TRANSITION =
  "lg:transition-[left,margin-left,padding-left,width,basis] lg:duration-200 lg:ease-in-out";

/** Full viewport width under the fixed sidebar (desktop). */
export const SIDEBAR_BLEED_SHELL =
  `w-full lg:ml-[calc(-1*var(--sidebar-w,16rem))] lg:w-screen lg:max-w-none ${SIDEBAR_SYNC_TRANSITION}`;

/** Explore spotlight: gapless full-width slides. */
export const SPOTLIGHT_SLIDE_CLASS =
  "h-full !basis-full !pl-0";

/** Explore spotlight: embla track (no default pl-4 gutter). */
export const SPOTLIGHT_TRACK_CLASS = "!ml-0 h-full";

/** Explore spotlight shell: true viewport width, shifted left from the main column. */
export const SPOTLIGHT_SHELL_WIDTH =
  "lg:w-screen";

/** Overlay / controls aligned to the main content column. */
export const SPOTLIGHT_CONTENT_INSET =
  `pl-4 lg:pl-[calc(var(--sidebar-w,16rem)+1rem)] ${SIDEBAR_SYNC_TRANSITION}`;

export const SPOTLIGHT_ARROW_PREV =
  `left-4 lg:left-[calc(var(--sidebar-w,16rem)+1rem)] ${SIDEBAR_SYNC_TRANSITION}`;

export const SPOTLIGHT_ARROW_NEXT =
  "right-4";

export const SIDEBAR_BLEED_CAROUSEL_OPTS = {
  align: "start" as const,
  dragFree: true,
};

const SCROLL_HIDE =
  "overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

/** Embla viewport: full-bleed shell; first slide is the sidebar-width offset. */
export function sidebarBleedViewportClass(
  ...extra: (string | false | null | undefined)[]
) {
  return cn(SIDEBAR_BLEED_SHELL, extra);
}

/** Embla viewport: 100vw under the sidebar (Explore spotlight). */
export const SPOTLIGHT_VIEWPORT_CLASS = sidebarBleedViewportClass("h-full");

/** Desktop-only leading slide matching the sidebar width. */
export function SidebarBleedStartSpacer() {
  const show = useSidebarBleedOffset();
  if (!show) return null;

  return (
    <CarouselItem
      aria-hidden
      className="shrink-0 grow-0 basis-[var(--sidebar-w,16rem)] pl-0 lg:transition-[basis,width] lg:duration-200 lg:ease-in-out"
    >
      <span className="sr-only">Sidebar offset</span>
    </CarouselItem>
  );
}

/** Desktop-only leading gap for native horizontal scroll tracks. */
export function SidebarBleedNativeStart() {
  const show = useSidebarBleedOffset();
  if (!show) return null;

  return (
    <div
      className="shrink-0 w-[var(--sidebar-w,16rem)]"
      aria-hidden
    />
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
