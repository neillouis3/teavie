"use client";

import React from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { StarIcon } from "@hugeicons/core-free-icons";

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
    <HugeiconsIcon
      icon={StarIcon}
      size={size}
      strokeWidth={filled ? 1.25 : 2}
      className={
        filled
          ? `shrink-0 [&_path]:!fill-[var(--favorite-star-color)] [&_path]:!stroke-[var(--favorite-star-color)] ${className}`
          : `shrink-0 ${className}`
      }
      style={
        filled
          ? ({
              color: filledColor,
              "--favorite-star-color": filledColor,
            } as React.CSSProperties)
          : undefined
      }
    />
  );
}
