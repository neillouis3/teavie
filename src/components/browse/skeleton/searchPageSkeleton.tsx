"use client";

import React from "react";
import Header from "@/components/ui/header";
import CatalogGridLoading from "@/components/browse/skeleton/catalogGridLoading";
import CatalogFilterBarSkeleton from "@/components/browse/skeleton/catalogFilterBarSkeleton";
import { CONTENT_INSET_X } from "@/lib/contentInset";

export default function SearchPageSkeleton() {
  return (
    <div className="bg-main min-h-screen w-full">
      <Header pageName="Search" />
      <div className={`space-y-6 pb-6 pt-2 ${CONTENT_INSET_X}`}>
        <div className="space-y-2">
          <div className="h-9 w-full animate-pulse rounded-md bg-default-200 dark:bg-white/10" />
          <CatalogFilterBarSkeleton variant="search" />
        </div>
        <CatalogGridLoading count={14} variant="search" />
        <div className="flex justify-center pt-2">
          <div className="h-8 w-56 animate-pulse rounded-lg bg-default-200 dark:bg-white/10" />
        </div>
      </div>
    </div>
  );
}
