"use client";

import React from "react";
import { Button } from "@heroui/react";
import { useUserData } from "@/contexts/userDataContext";
import FavoriteStarIcon from "@/components/favorites/FavoriteStarIcon";

type FavoriteButtonProps = {
  catalogId: string;
  mediaType: "movie" | "tv";
  size?: "sm" | "md" | "lg";
  iconOnly?: boolean;
  className?: string;
  radius?: "none" | "sm" | "md" | "lg" | "full";
};

export default function FavoriteButton({
  catalogId,
  mediaType,
  size = "sm",
  iconOnly = false,
  className,
  radius,
}: FavoriteButtonProps) {
  const { isFavorite, toggleFavorite } = useUserData();
  const saved = isFavorite(catalogId);

  if (iconOnly) {
    return (
      <Button
        isIconOnly
        size={size}
        radius={radius}
        className={className}
        variant={saved ? "solid" : "flat"}
        color={saved ? "warning" : "default"}
        aria-label={saved ? "Remove from favorites" : "Add to favorites"}
        onPress={() => void toggleFavorite(catalogId, mediaType)}
      >
        <FavoriteStarIcon filled={saved} filledColor="#f5a524" size={18} />
      </Button>
    );
  }

  return (
    <Button
      size={size}
      radius={radius}
      className={className}
      variant={saved ? "solid" : "flat"}
      color={saved ? "warning" : "default"}
      onPress={() => void toggleFavorite(catalogId, mediaType)}
      startContent={<FavoriteStarIcon filled={saved} filledColor="#111827" />}
    >
      {saved ? "Favorited" : "Favorite"}
    </Button>
  );
}
