"use client";

import React from "react";
import Link from "next/link";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowRight01Icon } from "@hugeicons/core-free-icons";
import { categoryBrowseSortHref, type CatalogCategory } from "@/lib/catalogCategories";
import { cn } from "@/lib/utils";

const CHROME_BLUR_CLASS =
  "border border-white/15 bg-black/45 shadow-[0_8px_32px_rgba(0,0,0,0.35)] backdrop-blur-2xl backdrop-saturate-150 supports-[backdrop-filter]:bg-black/38";

type CategoryBrowseBarProps = {
  category: CatalogCategory;
  className?: string;
  /** Overlay at the bottom of the category hero spotlight. */
  overlay?: boolean;
};

/** Browse-all link for category hub heroes. */
export default function CategoryBrowseBar({
  category,
  className,
  overlay = false,
}: CategoryBrowseBarProps) {
  const href = categoryBrowseSortHref(category, "popularity");
  const label = category.browseAllLabel;

  const link = (
    <Link
      href={href}
      className={cn(
        "inline-flex min-h-11 items-center gap-2 rounded-full px-5 text-sm font-medium text-white transition-colors",
        "hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent",
        overlay ? CHROME_BLUR_CLASS : "border border-divider bg-content1/40 backdrop-blur-sm dark:bg-white/[0.06]"
      )}
    >
      <span>{label}</span>
      <HugeiconsIcon
        icon={ArrowRight01Icon}
        size={16}
        strokeWidth={2}
        className="shrink-0 opacity-90"
        aria-hidden
      />
    </Link>
  );

  if (overlay) {
    return (
      <nav
        aria-label={`Browse ${category.label}`}
        className={cn(
          "pointer-events-none absolute inset-x-0 bottom-4 z-20 flex justify-start px-4 lg:bottom-6 lg:px-24",
          className
        )}
      >
        <div className="pointer-events-auto">{link}</div>
      </nav>
    );
  }

  return (
    <nav aria-label={`Browse ${category.label}`} className={cn("w-full", className)}>
      {link}
    </nav>
  );
}
