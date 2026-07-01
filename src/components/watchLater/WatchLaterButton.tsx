"use client";

import React from "react";
import { Button } from "@heroui/react";
import WatchLaterBookmarkIcon from "@/components/watchLater/WatchLaterBookmarkIcon";
import { useUserData } from "@/contexts/userDataContext";

type WatchLaterButtonProps = {
  catalogId: string;
  mediaType: "movie" | "tv";
  size?: "sm" | "md";
  iconOnly?: boolean;
};

export default function WatchLaterButton({
  catalogId,
  mediaType,
  size = "sm",
  iconOnly = false,
}: WatchLaterButtonProps) {
  const { isWatchLater, toggleWatchLater } = useUserData();
  const saved = isWatchLater(catalogId);

  if (iconOnly) {
    return (
      <Button
        isIconOnly
        size={size}
        variant={saved ? "solid" : "flat"}
        color={saved ? "success" : "default"}
        aria-label={saved ? "Remove from watch later" : "Add to watch later"}
        onPress={() => void toggleWatchLater(catalogId, mediaType)}
      >
        <WatchLaterBookmarkIcon filled={saved} />
      </Button>
    );
  }

  return (
    <Button
      size={size}
      variant={saved ? "solid" : "flat"}
      color={saved ? "success" : "default"}
      onPress={() => void toggleWatchLater(catalogId, mediaType)}
      startContent={<WatchLaterBookmarkIcon filled={saved} />}
    >
      {saved ? "Saved" : "Watch later"}
    </Button>
  );
}
