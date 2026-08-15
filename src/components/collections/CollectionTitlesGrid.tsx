"use client";

import React, { useMemo, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Search01Icon } from "@hugeicons/core-free-icons";
import SmallCard from "@/components/ui/smallCard";
import SmallCardLoading from "@/components/ui/smallCardLoading";
import { COLLECTION_PAGE_GRID_CLASS } from "@/lib/catalogGrid";
import {
  CATALOG_PAGE_HEADER,
  PAGE_BODY,
  PAGE_CONTENT_OUTER,
  PAGE_FOOTER,
  PAGE_FOOTER_BODY,
  PAGE_FOOTER_TITLE,
  PAGE_META,
  PAGE_SEARCH_INPUT,
  PAGE_SECTION,
  PAGE_TITLE_CENTERED,
} from "@/lib/pageLayout";
import type { ContentItem } from "@/types/content";

type CollectionTitlesGridProps = {
  title: string;
  overview?: string | null;
  items: ContentItem[];
  loading: boolean;
  error: boolean;
};

function itemYear(item: ContentItem) {
  const raw = item.release_date ?? "";
  return raw.length >= 4 ? raw.slice(0, 4) : "—";
}

function CollectionGridSkeleton() {
  return (
    <div className={COLLECTION_PAGE_GRID_CLASS} aria-hidden>
      {Array.from({ length: 8 }, (_, i) => (
        <div key={i} className="w-36 sm:w-40">
          <SmallCardLoading />
        </div>
      ))}
    </div>
  );
}

export default function CollectionTitlesGrid({
  title,
  overview = null,
  items,
  loading,
  error,
}: CollectionTitlesGridProps) {
  const [searchQuery, setSearchQuery] = useState("");

  const metaParts = useMemo(() => {
    const years = items
      .map((item) => {
        const raw = item.release_date ?? "";
        return raw.length >= 4 ? raw.slice(0, 4) : null;
      })
      .filter((year): year is string => Boolean(year))
      .sort();
    const range =
      years.length === 0
        ? null
        : years[0] === years[years.length - 1]
          ? years[0]
          : `${years[0]} – ${years[years.length - 1]}`;
    return ["Collection", range].filter(Boolean);
  }, [items]);

  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) => {
      const name = (item.title ?? item.name ?? "").toLowerCase();
      return name.includes(q) || (item.overview ?? "").toLowerCase().includes(q);
    });
  }, [items, searchQuery]);

  return (
    <div className="relative w-full">
      <div className={PAGE_CONTENT_OUTER}>
        <header className={CATALOG_PAGE_HEADER}>
          <h1 className={PAGE_TITLE_CENTERED}>{title}</h1>

          {metaParts.length > 0 ? (
            <p className={PAGE_META}>{metaParts.join(" · ")}</p>
          ) : null}

          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            <div className="relative">
              <HugeiconsIcon
                icon={Search01Icon}
                size={15}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-default-400"
              />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search"
                className={PAGE_SEARCH_INPUT}
              />
            </div>
          </div>
        </header>

        <section className={PAGE_SECTION} aria-label="Titles">
          {loading ? (
            <CollectionGridSkeleton />
          ) : error ? (
            <p className={`text-center ${PAGE_BODY}`}>
              Could not load this collection. Try again later.
            </p>
          ) : filteredItems.length === 0 ? (
            <p className={`text-center ${PAGE_BODY}`}>
              {searchQuery.trim()
                ? "No titles match your search."
                : "No titles from this collection are in the catalog yet."}
            </p>
          ) : (
            <div className={COLLECTION_PAGE_GRID_CLASS}>
              {filteredItems.map((item, index) => {
                const cardTitle = item.title ?? item.name ?? "Untitled";
                const releaseDate = item.release_date ?? "";

                return (
                  <div key={String(item.id)} className="w-36 sm:w-40">
                    <SmallCard
                      id={item.id}
                      title={cardTitle}
                      year={itemYear(item)}
                      type="movie"
                      posterPath={item.poster_path ?? ""}
                      overview={item.overview}
                      releaseDate={releaseDate || undefined}
                      runtimeSeconds={item.runtimeSeconds ?? undefined}
                      seasonAmount={0}
                      priority={index < 8}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {overview?.trim() ? (
          <footer className={PAGE_FOOTER}>
            <h2 className={PAGE_FOOTER_TITLE}>{title}</h2>
            <p className={PAGE_FOOTER_BODY}>{overview.trim()}</p>
          </footer>
        ) : null}
      </div>
    </div>
  );
}
