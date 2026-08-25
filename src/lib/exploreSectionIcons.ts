import type { IconSvgElement } from "@hugeicons/react";

export type ExploreSectionIcon =
  | { kind: "asset"; src: string }
  | { kind: "huge"; icon: IconSvgElement };

function normalizeSectionTitle(title: string): string {
  return title.trim().toLowerCase().replace(/\s+/g, " ");
}

const SECTION_TITLE_ICONS: Record<string, string> = {
  "continue watching": "/rail-icons/play.svg",
  "watch history": "/rail-icons/clock.svg",
  favorites: "/rail-icons/star.svg",
  "watch later": "/rail-icons/bookmark.svg",
  popular: "/rail-icons/galaxy-star.svg",
  "popular movies": "/rail-icons/clapper-open.svg",
  "popular tv shows": "/rail-icons/tv-retro.svg",
  "recommended for you": "/rail-icons/galaxy-star.svg",
  new: "/rail-icons/galaxy-star.svg",
  "new & upcoming": "/rail-icons/calendar-clock.svg",
  "new and upcoming": "/rail-icons/calendar-clock.svg",
  "new on teavie": "/rail-icons/new-product.svg",
  "recently updated": "/rail-icons/clock.svg",
  "more like this": "/rail-icons/heart.svg",
  "browse by genre": "/rail-icons/apps.svg",
  featured: "/rail-icons/star.svg",
  "top rated": "/rail-icons/star.svg",
  artwork: "/rail-icons/camera-movie.svg",
  sports: "/rail-icons/football.svg",
};

export function exploreSectionIcon(title: string): ExploreSectionIcon | undefined {
  const normalized = normalizeSectionTitle(title);

  if (normalized.includes("anime")) {
    return { kind: "asset", src: "/rail-icons/citrus.svg" };
  }
  if (normalized.includes("korean") || normalized.includes("k-drama")) {
    return { kind: "asset", src: "/rail-icons/mug-hot-alt.svg" };
  }

  const src = SECTION_TITLE_ICONS[normalized];
  return src ? { kind: "asset", src } : undefined;
}
