"use client";

import React from "react";
import { cn } from "@/lib/utils";

type SidebarBleedRailProps = {
  children: React.ReactNode;
  className?: string;
  /** Native horizontal scroll (e.g. grid rails) instead of Embla. */
  scrollable?: boolean;
};

/** Full-viewport-width rail shell (sits in the main column, extends under the sidebar). */
export const SIDEBAR_BLEED_SHELL =
  "w-full lg:-ml-[var(--sidebar-w,16rem)] lg:w-screen lg:max-w-[100vw]";

/** Padding on the scroll track so the first card aligns with page content. */
export const SIDEBAR_BLEED_TRACK_INSET =
  "box-border pr-3 sm:pr-4 lg:pl-[var(--sidebar-w,16rem)]";

const SCROLL_HIDE =
  "overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

export function sidebarBleedTrackClass(...extra: ClassValue[]) {
  return cn(SIDEBAR_BLEED_TRACK_INSET, ...extra);
}

type ClassValue = string | false | null | undefined;

export default function SidebarBleedRail({
  children,
  className,
  scrollable = false,
}: SidebarBleedRailProps) {
  return (
    <div className={cn(SIDEBAR_BLEED_SHELL, scrollable && SCROLL_HIDE, className)}>
      {children}
    </div>
  );
}
