"use client";

import React, { useEffect } from "react";
import Header from "@/components/ui/header";
import { listCatalogCategories } from "@/lib/catalogCategories";
import {
  CategorySquareTile,
  CategorySquareTilesSkeleton,
} from "@/components/category/categoryTileShared";
import { CONTENT_INSET_X } from "@/lib/contentInset";

export default function CategoriesIndexPage() {
  const categories = listCatalogCategories();

  useEffect(() => {
    document.title = "Categories - Teavie";
  }, []);

  return (
    <div className="bg-main min-h-screen w-full">
      <Header pageName="Categories" />
      <div className={`w-full pb-12 pt-2 ${CONTENT_INSET_X}`}>
        {categories.length === 0 ? (
          <CategorySquareTilesSkeleton />
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {categories.map((category) => (
              <CategorySquareTile key={category.slug} category={category} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
