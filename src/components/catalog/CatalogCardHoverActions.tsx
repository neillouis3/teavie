"use client";

import React from "react";
import { useUserData } from "@/contexts/userDataContext";
import FavoriteStarIcon from "@/components/favorites/FavoriteStarIcon";
import WatchLaterBookmarkIcon from "@/components/watchLater/WatchLaterBookmarkIcon";

const ACTION_BTN_BASE =
  "flex h-7 w-7 items-center justify-center rounded-full bg-black/50 backdrop-blur-[2px] transition-colors hover:bg-black/70";
const ACTION_BTN_IDLE = `${ACTION_BTN_BASE} text-white`;

type CatalogCardHoverActionsProps = {
  catalogId: string;
  mediaType: "movie" | "tv";
  title: string;
  showFavorite?: boolean;
  showWatchLater?: boolean;
};

export default function CatalogCardHoverActions({
  catalogId,
  mediaType,
  title,
  showFavorite = true,
  showWatchLater = true,
}: CatalogCardHoverActionsProps) {
  const { isFavorite, toggleFavorite, isWatchLater, toggleWatchLater } = useUserData();
  const favorited = isFavorite(catalogId);
  const savedLater = isWatchLater(catalogId);

  if (!showFavorite && !showWatchLater) return null;

  const hoverRevealClass =
    "opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-within:opacity-100";

  return (
    <>
      {showFavorite ? (
        <button
          type="button"
          className={`pointer-events-auto absolute left-1.5 top-1.5 z-20 ${ACTION_BTN_IDLE} ${hoverRevealClass}`}
          aria-label={
            favorited ? `Remove ${title} from favorites` : `Add ${title} to favorites`
          }
          aria-pressed={favorited}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            void toggleFavorite(catalogId, mediaType);
          }}
        >
          <FavoriteStarIcon filled={favorited} />
        </button>
      ) : null}
      {showWatchLater ? (
        <button
          type="button"
          className={`pointer-events-auto absolute right-1.5 top-1.5 z-20 ${ACTION_BTN_IDLE} ${hoverRevealClass}`}
          aria-label={
            savedLater ? `Remove ${title} from watch later` : `Add ${title} to watch later`
          }
          aria-pressed={savedLater}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            void toggleWatchLater(catalogId, mediaType);
          }}
        >
          <WatchLaterBookmarkIcon filled={savedLater} />
        </button>
      ) : null}
    </>
  );
}
