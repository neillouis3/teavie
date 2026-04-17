import type { IconSvgElement } from '@hugeicons/react';
import {
  Home01Icon,
  Film01Icon,
  Tv01Icon,
  Award01Icon,
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
      { key: "movies", label: "Movies", href: "/movies/all", icon: Film01Icon },
      { key: "shows", label: "TV Shows", href: "/shows/all", icon: Tv01Icon },
    ],
  },
  {
    id: "categories",
    title: "Categories",
    items: [
      { key: "anime", label: "Anime", href: "/anime/all", icon: Tv01Icon },
      { key: "sports", label: "Sports", href: "/sports", icon: Award01Icon },
    ],
  },
];

/** Flat list (browse order, then categories) for simple consumers. */
export const APP_NAV_ITEMS: AppNavItem[] = APP_NAV_SECTIONS.flatMap((s) => s.items);
