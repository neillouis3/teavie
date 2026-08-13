"use client";

import React from "react";
import Link from "next/link";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ArrowRight01Icon,
  FireIcon,
  LayoutGridIcon,
  StarIcon,
} from "@hugeicons/core-free-icons";
import {
  categoryBrowseSortHref,
  type CatalogCategory,
} from "@/lib/catalogCategories";
import { cn } from "@/lib/utils";

type BrowseAction = {
  key: string;
  label: string;
  href: string;
  icon: typeof LayoutGridIcon;
  primary?: boolean;
};

function browseActions(category: CatalogCategory): BrowseAction[] {
  return [
    {
      key: "catalog",
      label: "Full catalog",
      href: categoryBrowseSortHref(category, "title"),
      icon: LayoutGridIcon,
      primary: true,
    },
    {
      key: "popular",
      label: "Popular",
      href: categoryBrowseSortHref(category, "popularity"),
      icon: FireIcon,
    },
    {
      key: "top-rated",
      label: "Top rated",
      href: categoryBrowseSortHref(category, "rating"),
      icon: StarIcon,
    },
  ];
}

type CategoryBrowseBarProps = {
  category: CatalogCategory;
  className?: string;
};

/** Quick browse links — placed directly under the category hero for easy access. */
export default function CategoryBrowseBar({
  category,
  className,
}: CategoryBrowseBarProps) {
  const actions = browseActions(category);

  return (
    <nav
      aria-label={`Browse ${category.label}`}
      className={cn("w-full", className)}
    >
      <div className="rounded-2xl border border-divider/80 bg-content1/40 p-3 backdrop-blur-sm dark:bg-white/[0.04] sm:p-4">
        <p className="mb-3 text-sm text-default-600 dark:text-default-400">
          Jump into the full {category.label.toLowerCase()} catalog or browse by
          what&apos;s trending.
        </p>
        <ul className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {actions.map((action) => (
            <li key={action.key} className="shrink-0">
              <Link
                href={action.href}
                className={cn(
                  "inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-sm font-medium transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-success focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                  action.primary
                    ? "bg-success text-success-foreground hover:opacity-90"
                    : "border border-divider bg-background/60 text-foreground hover:bg-default-100 dark:bg-white/[0.06] dark:hover:bg-white/[0.10]"
                )}
              >
                <HugeiconsIcon
                  icon={action.icon}
                  size={16}
                  strokeWidth={1.75}
                  className="shrink-0"
                  aria-hidden
                />
                <span>{action.label}</span>
                {action.primary ? (
                  <HugeiconsIcon
                    icon={ArrowRight01Icon}
                    size={14}
                    strokeWidth={2}
                    className="shrink-0 opacity-80"
                    aria-hidden
                  />
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}
