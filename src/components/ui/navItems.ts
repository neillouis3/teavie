import type { ComponentType, SVGProps } from 'react';
import {
  HomeIcon,
  FilmIcon,
  TvIcon,
  TrophyIcon,
} from '@heroicons/react/24/outline';

export type NavIcon = ComponentType<SVGProps<SVGSVGElement>>;

export type AppNavItem = {
  key: string;
  label: string;
  href: string;
  Icon: NavIcon;
};

export const APP_NAV_ITEMS: AppNavItem[] = [
  { key: 'explore', label: 'Explore', href: '/explore', Icon: HomeIcon },
  { key: 'movies', label: 'Movies', href: '/movies/all', Icon: FilmIcon },
  { key: 'shows', label: 'TV Shows', href: '/shows/all', Icon: TvIcon },
  { key: 'sports', label: 'Sports', href: '/sports', Icon: TrophyIcon },
];
