"use client";

import AssetMaskIcon from "@/components/ui/assetMaskIcon";

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
    <AssetMaskIcon
      src={filled ? "/rail-icons/bookmark.svg" : "/ui-icons/bookmark-outline.svg"}
      size={size}
      className={`shrink-0 ${className}`}
      style={filled ? { color: WATCH_LATER_GREEN } : undefined}
    />
  );
}
