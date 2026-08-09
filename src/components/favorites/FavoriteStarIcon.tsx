"use client";

import AssetMaskIcon from "@/components/ui/assetMaskIcon";

const FAVORITE_ORANGE = "#fb923c";

type FavoriteStarIconProps = {
  filled?: boolean;
  size?: number;
  className?: string;
  filledColor?: string;
};

export default function FavoriteStarIcon({
  filled = false,
  size = 16,
  className = "",
  filledColor = FAVORITE_ORANGE,
}: FavoriteStarIconProps) {
  return (
    <AssetMaskIcon
      src={filled ? "/rail-icons/star.svg" : "/ui-icons/star-outline.svg"}
      size={size}
      className={`shrink-0 ${className}`}
      style={filled ? { color: filledColor } : undefined}
    />
  );
}
