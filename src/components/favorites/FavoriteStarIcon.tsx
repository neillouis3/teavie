"use client";

import React from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { StarIcon } from "@hugeicons/core-free-icons";

const FAVORITE_ORANGE = "#fb923c";

type FavoriteStarIconProps = {
  filled?: boolean;
  size?: number;
  className?: string;
};

export default function FavoriteStarIcon({
  filled = false,
  size = 16,
  className = "",
}: FavoriteStarIconProps) {
  return (
    <HugeiconsIcon
      icon={StarIcon}
      size={size}
      strokeWidth={filled ? 1.25 : 2}
      className={
        filled
          ? `shrink-0 [&_path]:!fill-[#fb923c] [&_path]:!stroke-[#fb923c] ${className}`
          : `shrink-0 ${className}`
      }
      style={filled ? { color: FAVORITE_ORANGE } : undefined}
    />
  );
}
