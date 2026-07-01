"use client";

import React from "react";
import { Button } from "@heroui/react";
import { useUserData } from "@/contexts/userDataContext";
import FavoriteStarIcon from "@/components/favorites/FavoriteStarIcon";

type FavoriteButtonProps = {
  catalogId: string;
  mediaType: "movie" | "tv";
  size?: "sm" | "md";
  iconOnly?: boolean;
};

export default function FavoriteButton({
  catalogId,
  mediaType,
  size = "sm",
  iconOnly = false,
}: FavoriteButtonProps) {
  const { isFavorite, toggleFavorite } = useUserData();
  const saved = isFavorite(catalogId);

  if (iconOnly) {
    return (
      <Button
        isIconOnly
        size={size}
        variant={saved ? "solid" : "flat"}
        color={saved ? "warning" : "default"}
        aria-label={saved ? "Remove from favorites" : "Add to favorites"}
        onPress={() => void toggleFavorite(catalogId, mediaType)}
      >
        <FavoriteStarIcon filled={saved} />
      </Button>
    );
  }

  return (
    <Button
      size={size}
      variant={saved ? "solid" : "flat"}
      color={saved ? "warning" : "default"}
      onPress={() => void toggleFavorite(catalogId, mediaType)}
      startContent={<FavoriteStarIcon filled={saved} />}
    >
      {saved ? "Favorited" : "Favorite"}
    </Button>
  );
}
