"use client";

import React from "react";
import { cn } from "@/lib/utils";

type SidebarBleedRailProps = {
  children: React.ReactNode;
  className?: string;
  innerClassName?: string;
  /** Native horizontal scroll (e.g. grid rails) instead of Embla. */
  scrollable?: boolean;
};

/** Full-viewport-width rail shell; inner track starts aligned with the main column. */
export const SIDEBAR_BLEED_SHELL =
  "w-full lg:-ml-[var(--sidebar-w,16rem)] lg:w-screen lg:max-w-[100vw]";

export const SIDEBAR_BLEED_INSET =
  "pr-3 sm:pr-4 lg:pl-[var(--sidebar-w,16rem)]";

const SCROLL_HIDE =
  "overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

export default function SidebarBleedRail({
  children,
  className,
  innerClassName,
  scrollable = false,
}: SidebarBleedRailProps) {
  return (
    <div className={cn(SIDEBAR_BLEED_SHELL, scrollable && SCROLL_HIDE, className)}>
      <div className={cn(SIDEBAR_BLEED_INSET, innerClassName)}>{children}</div>
    </div>
  );
}
