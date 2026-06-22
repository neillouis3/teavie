import type { IconSvgElement } from '@hugeicons/react';
import {
  Home01Icon,
  FilmRoll02Icon,
  Tv01Icon,
  PopcornIcon,
  OrangeIcon,
  LoveKoreanFingerIcon,
  GridViewIcon,
} from '@hugeicons/core-free-icons';

export type NavIcon = IconSvgElement;

export type AppNavItem = {
  key: string;
  label: string;
  href: string;
  icon: NavIcon;
};

export type AppNavSection = {
  id: string;
  /** Sidebar section heading; omit for the primary links block. */
  title: string | null;
  items: AppNavItem[];
};

export const APP_NAV_SECTIONS: AppNavSection[] = [
  {
    id: "browse",
    title: null,
    items: [
      { key: "explore", label: "Explore", href: "/explore", icon: Home01Icon },
      { key: "discover", label: "Discover", href: "/discover", icon: PopcornIcon },
      { key: "movies", label: "Movies", href: "/movies/all", icon: FilmRoll02Icon },
      { key: "shows", label: "TV Shows", href: "/shows/all", icon: Tv01Icon },
      { key: "genres", label: "Genres", href: "/genres", icon: GridViewIcon },
    ],
  },
  {
    id: "categories",
    title: "Categories",
    items: [
      { key: "anime", label: "Anime", href: "/anime/all", icon: OrangeIcon },
      { key: "kdrama", label: "Korean Drama", href: "/kdrama", icon: LoveKoreanFingerIcon },
    ],
  },
];

/** Flat list (browse order, then categories) for simple consumers. */
export const APP_NAV_ITEMS: AppNavItem[] = APP_NAV_SECTIONS.flatMap((s) => s.items);
