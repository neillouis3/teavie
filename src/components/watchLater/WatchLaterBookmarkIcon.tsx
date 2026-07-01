"use client";

import React from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Bookmark02Icon } from "@hugeicons/core-free-icons";

const WATCH_LATER_GREEN = "#17c964";

type WatchLaterBookmarkIconProps = {
  filled?: boolean;
  size?: number;
  className?: string;
};

export default function WatchLaterBookmarkIcon({
  filled = false,
  size = 16,
  className = "",
}: WatchLaterBookmarkIconProps) {
  return (
    <HugeiconsIcon
      icon={Bookmark02Icon}
      size={size}
      strokeWidth={filled ? 1.25 : 2}
      className={
        filled
          ? `shrink-0 [&_path]:!fill-[#17c964] [&_path]:!stroke-[#17c964] ${className}`
          : `shrink-0 ${className}`
      }
      style={filled ? { color: WATCH_LATER_GREEN } : undefined}
    />
  );
}
