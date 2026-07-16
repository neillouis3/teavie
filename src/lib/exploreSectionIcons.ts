import type { IconSvgElement } from "@hugeicons/react";
import {
  Bookmark02Icon,
  Calendar01Icon,
  ChartIncreaseIcon,
  Clock02Icon,
  Film02Icon,
  FireIcon,
  GridViewIcon,
  Image02Icon,
  OrangeIcon,
  PopcornIcon,
  SparklesIcon,
  StarIcon,
  Tv01Icon,
} from "@hugeicons/core-free-icons";

function normalizeSectionTitle(title: string): string {
  return title.trim().toLowerCase().replace(/\s+/g, " ");
}

const SECTION_TITLE_ICONS: Record<string, IconSvgElement> = {
  "continue watching": Clock02Icon,
  favorites: StarIcon,
  "watch later": Bookmark02Icon,
  popular: FireIcon,
  "popular movies": Film02Icon,
  "popular tv shows": Tv01Icon,
  "recommended for you": PopcornIcon,
  new: SparklesIcon,
  "new & upcoming": Calendar01Icon,
  "new on teavie": SparklesIcon,
  "browse by genre": GridViewIcon,
  featured: StarIcon,
  "top rated": ChartIncreaseIcon,
  "you might like": SparklesIcon,
  "related anime": OrangeIcon,
  artwork: Image02Icon,
};

export function exploreSectionIcon(title: string): IconSvgElement | undefined {
  return SECTION_TITLE_ICONS[normalizeSectionTitle(title)];
}
