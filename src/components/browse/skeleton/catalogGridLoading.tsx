"use client";

import React from "react";
import SmallCardLoading from "@/components/ui/smallCardLoading";
import HorizontalCatalogCardLoading from "@/components/ui/horizontalCatalogCardLoading";
import { useCatalogCardStyle } from "@/contexts/catalogCardStyleContext";
import {
  CATALOG_GRID_HORIZONTAL,
  CATALOG_GRID_HORIZONTAL_SEARCH,
  CATALOG_GRID_VERTICAL,
  CATALOG_GRID_VERTICAL_SEARCH,
} from "@/lib/catalogGrid";

type CatalogGridLoadingProps = {
  count?: number;
  variant?: "browse" | "search";
};

export default function CatalogGridLoading({
  count = 28,
  variant = "browse",
}: CatalogGridLoadingProps) {
  const { mode } = useCatalogCardStyle();
  const horizontal = mode === "horizontal";
  const gridClass =
    variant === "search"
      ? horizontal
        ? CATALOG_GRID_HORIZONTAL_SEARCH
        : CATALOG_GRID_VERTICAL_SEARCH
      : horizontal
        ? CATALOG_GRID_HORIZONTAL
        : CATALOG_GRID_VERTICAL;
  const CardSkeleton = horizontal
    ? HorizontalCatalogCardLoading
    : SmallCardLoading;

  return (
    <div className={gridClass}>
      {Array.from({ length: count }).map((_, index) => (
        <CardSkeleton key={index} />
      ))}
    </div>
  );
}
