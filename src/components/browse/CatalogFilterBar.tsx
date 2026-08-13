"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { Input, Button, Select, SelectItem } from "@heroui/react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Search01Icon, Cancel01Icon } from "@hugeicons/core-free-icons";
import {
  IMDB_GENRES,
  imdbGenreSlugFromBrowseParam,
} from "@/lib/imdbGenres.js";
import {
  BROWSE_SORT_OPTIONS,
  SEARCH_SORT_OPTIONS,
  catalogYearChoices,
} from "@/lib/catalogSortOptions";
import {
  catalogFilterSelectClassNames,
  catalogFilterSortClassNames,
} from "@/components/browse/catalogFilterStyles";

type ImdbGenre = { slug: string; label: string };
type SelectRow = { id: string; label: string };

export type CatalogFilterBarVariant = "browse" | "search";

type CatalogFilterBarProps = {
  variant: CatalogFilterBarVariant;
  /** Browse only: unused for search. */
  genreSlugs?: string[];
  defaultSort?: string;
};

export default function CatalogFilterBar({
  variant,
  genreSlugs,
  defaultSort,
}: CatalogFilterBarProps) {
  const isBrowse = variant === "browse";
  const sortOptions = isBrowse ? BROWSE_SORT_OPTIONS : SEARCH_SORT_OPTIONS;
  const fallbackSort = defaultSort ?? (isBrowse ? "title" : "relevance");

  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const rawSort = searchParams.get("sort_by") || fallbackSort;
  const sortBy = sortOptions.some((o) => o.key === rawSort) ? rawSort : fallbackSort;
  const rawGenre = searchParams.get("genre") || "";
  const genre = imdbGenreSlugFromBrowseParam(rawGenre) ?? rawGenre;
  const yearMin = searchParams.get("year_min") || "";
  const yearMax = searchParams.get("year_max") || "";
  const qUrl = searchParams.get("q") || "";

  const [searchDraft, setSearchDraft] = useState(qUrl);
  useEffect(() => {
    if (isBrowse) setSearchDraft(qUrl);
  }, [isBrowse, qUrl]);

  const years = useMemo(() => catalogYearChoices(), []);

  const sortItems: SelectRow[] = useMemo(
    () => sortOptions.map((o) => ({ id: o.key, label: o.label })),
    [sortOptions]
  );

  const genreItems: SelectRow[] = useMemo(() => {
    const all = (IMDB_GENRES as ImdbGenre[]).map((g) => ({
      id: g.slug,
      label: g.label,
    }));
    if (!isBrowse || !genreSlugs?.length) return all;
    const allowed = new Set(genreSlugs);
    return all.filter((g) => allowed.has(g.id));
  }, [genreSlugs, isBrowse]);

  const yearItems: SelectRow[] = useMemo(
    () => years.map((y) => ({ id: y, label: y })),
    [years]
  );

  const mergeParams = useCallback(
    (patch: Record<string, string | null | undefined>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [k, v] of Object.entries(patch)) {
        if (
          !v ||
          (!isBrowse && k === "sort_by" && v === "relevance")
        ) {
          params.delete(k);
        } else {
          params.set(k, String(v));
        }
      }
      router.push(`${pathname}?${params.toString()}`);
    },
    [isBrowse, pathname, router, searchParams]
  );

  useEffect(() => {
    if (!isBrowse) return;
    const trimmed = searchDraft.trim();
    if (trimmed === qUrl.trim()) return;

    const timer = window.setTimeout(() => {
      mergeParams({ q: trimmed || null, page: "1" });
    }, 400);

    return () => window.clearTimeout(timer);
  }, [isBrowse, searchDraft, qUrl, mergeParams]);

  useEffect(() => {
    if (isBrowse) return;
    if (!searchParams.get("type")) return;
    const params = new URLSearchParams(searchParams.toString());
    params.delete("type");
    const next = params.toString();
    router.replace(next ? `${pathname}?${next}` : pathname);
  }, [isBrowse, pathname, router, searchParams]);

  useEffect(() => {
    if (!rawGenre) return;
    const normalized = imdbGenreSlugFromBrowseParam(rawGenre);
    if (normalized && normalized !== rawGenre) {
      mergeParams({ genre: normalized, page: "1" });
    }
  }, [rawGenre, mergeParams]);

  const hasActiveFilters = isBrowse
    ? Boolean(genre) ||
      Boolean(yearMin) ||
      Boolean(yearMax) ||
      Boolean(qUrl.trim())
    : sortBy !== "relevance" ||
      Boolean(genre) ||
      Boolean(yearMin) ||
      Boolean(yearMax);

  const clearFilters = () =>
    mergeParams({
      sort_by: isBrowse ? null : null,
      genre: null,
      year_min: null,
      year_max: null,
      q: isBrowse ? null : undefined,
      page: "1",
    });

  const onSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isBrowse) return;
    mergeParams({ q: searchDraft.trim() || null, page: "1" });
  };

  return (
    <section
      className={`w-full ${isBrowse ? "mb-4 space-y-3" : "space-y-2"}`}
      aria-label={isBrowse ? "Browse" : "Search filters"}
    >
      {isBrowse ? (
        <form onSubmit={onSearchSubmit} className="w-full">
          <Input
            aria-label="Search titles"
            placeholder="Search titles…"
            value={searchDraft}
            onValueChange={setSearchDraft}
            size="sm"
            variant="flat"
            radius="sm"
            className="w-full"
            startContent={
              <HugeiconsIcon
                icon={Search01Icon}
                size={16}
                className="shrink-0 text-default-400"
              />
            }
            classNames={{
              base: "w-full",
              input: "text-sm",
              inputWrapper: "h-9 w-full bg-default-100 hover:bg-default-200",
            }}
          />
        </form>
      ) : null}

      <div className="flex w-full flex-wrap items-end gap-2">
        <Select<SelectRow>
          aria-label="Sort by"
          placeholder="Sort"
          items={sortItems}
          selectedKeys={new Set([sortBy])}
          onSelectionChange={(keys) => {
            const v = Array.from(keys)[0] as string | undefined;
            if (v) mergeParams({ sort_by: v, page: "1" });
          }}
          size="sm"
          variant="bordered"
          radius="sm"
          classNames={catalogFilterSortClassNames}
        >
          {(item) => <SelectItem key={item.id}>{item.label}</SelectItem>}
        </Select>

        <Select<SelectRow>
          aria-label="Genre"
          placeholder="Genre"
          items={genreItems}
          selectedKeys={genre ? new Set([genre]) : new Set()}
          onSelectionChange={(keys) => {
            const v = Array.from(keys)[0] as string | undefined;
            if (v) mergeParams({ genre: v, page: "1" });
          }}
          size="sm"
          variant="bordered"
          radius="sm"
          classNames={catalogFilterSelectClassNames(Boolean(genre), true)}
        >
          {(item) => <SelectItem key={item.id}>{item.label}</SelectItem>}
        </Select>

        <Select<SelectRow>
          aria-label="Year from"
          placeholder="From"
          items={yearItems}
          selectedKeys={yearMin ? new Set([yearMin]) : new Set()}
          onSelectionChange={(keys) => {
            const v = Array.from(keys)[0] as string | undefined;
            if (v) mergeParams({ year_min: v, page: "1" });
          }}
          size="sm"
          variant="bordered"
          radius="sm"
          classNames={catalogFilterSelectClassNames(Boolean(yearMin))}
        >
          {(item) => <SelectItem key={item.id}>{item.label}</SelectItem>}
        </Select>

        <Select<SelectRow>
          aria-label="Year to"
          placeholder="To"
          items={yearItems}
          selectedKeys={yearMax ? new Set([yearMax]) : new Set()}
          onSelectionChange={(keys) => {
            const v = Array.from(keys)[0] as string | undefined;
            if (v) mergeParams({ year_max: v, page: "1" });
          }}
          size="sm"
          variant="bordered"
          radius="sm"
          classNames={catalogFilterSelectClassNames(Boolean(yearMax))}
        >
          {(item) => <SelectItem key={item.id}>{item.label}</SelectItem>}
        </Select>

        <Button
          variant="bordered"
          size="sm"
          radius="md"
          isDisabled={!hasActiveFilters}
          className="h-9 min-w-0 shrink-0 border-default-300 px-3 text-default-500 dark:border-white/15"
          startContent={
            <HugeiconsIcon icon={Cancel01Icon} size={14} className="shrink-0" />
          }
          onPress={clearFilters}
        >
          Clear
        </Button>
      </div>
    </section>
  );
}
