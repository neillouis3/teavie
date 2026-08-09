export type NavIcon = {
  src: string;
  activeSrc?: string;
};

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
      { key: "explore", label: "Explore", href: "/explore", icon: { src: "/ui-icons/home-outline.svg", activeSrc: "/ui-icons/home-filled.svg" } },
      { key: "movies", label: "Movies", href: "/movies/all", icon: { src: "/rail-icons/clapper-open.svg" } },
      { key: "shows", label: "TV Shows", href: "/shows/all", icon: { src: "/rail-icons/tv-retro.svg" } },
      { key: "sports", label: "Sports", href: "/sports", icon: { src: "/rail-icons/football.svg" } },
    ],
  },
  {
    id: "categories",
    title: "Categories",
    items: [
      { key: "anime", label: "Anime", href: "/anime", icon: { src: "/rail-icons/citrus.svg" } },
      { key: "kdrama", label: "Korean Drama", href: "/kdrama", icon: { src: "/rail-icons/mug-hot-alt.svg" } },
    ],
  },
];

/** Flat list (browse order, then categories) for simple consumers. */
export const APP_NAV_ITEMS: AppNavItem[] = APP_NAV_SECTIONS.flatMap((s) => s.items);
