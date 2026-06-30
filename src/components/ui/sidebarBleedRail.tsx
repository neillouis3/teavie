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

/** Full viewport width under the fixed sidebar (desktop). */
export const SIDEBAR_BLEED_SHELL =
  "w-full pr-4 lg:relative lg:left-[calc(-1*var(--sidebar-w,16rem))] lg:w-[100vw]";

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

/** Desktop-only leading slide matching the sidebar width. */
export function SidebarBleedStartSpacer() {
  const show = useSidebarBleedOffset();
  if (!show) return null;

  return (
    <CarouselItem
      aria-hidden
      className="shrink-0 grow-0 basis-[var(--sidebar-w,16rem)] pl-0"
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
