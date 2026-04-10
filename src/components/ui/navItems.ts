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

export const APP_NAV_ITEMS: AppNavItem[] = [
  { key: 'explore', label: 'Explore', href: '/explore', icon: Home01Icon },
  { key: 'movies', label: 'Movies', href: '/movies/all', icon: Film01Icon },
  { key: 'shows', label: 'TV Shows', href: '/shows/all', icon: Tv01Icon },
  { key: 'anime', label: 'Anime', href: '/anime/all', icon: Tv01Icon },
  { key: 'sports', label: 'Sports', href: '/sports', icon: Award01Icon },
];
