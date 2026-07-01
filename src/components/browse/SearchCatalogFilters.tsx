'use client';

import React, { useCallback, useEffect, useMemo } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { Button, Select, SelectItem } from '@heroui/react';
import { HugeiconsIcon } from '@hugeicons/react';
import { Cancel01Icon } from '@hugeicons/core-free-icons';
import {
  IMDB_GENRES,
  imdbGenreSlugFromBrowseParam,
} from '@/lib/imdbGenres.js';

type ImdbGenre = { slug: string; label: string };

const SORT_OPTIONS = [
  { key: 'relevance', label: 'Relevance' },
  { key: 'title', label: 'Title A-Z' },
  { key: 'title_desc', label: 'Title Z-A' },
  { key: 'release_year', label: 'Newest first' },
  { key: 'release_year_asc', label: 'Oldest first' },
  { key: 'popularity', label: 'Most popular' },
  { key: 'runtime_desc', label: 'Longest runtime' },
  { key: 'runtime_asc', label: 'Shortest runtime' },
] as const;

type SelectRow = { id: string; label: string };

const BORDERED_FIELD =
  'border-default-200/80 shadow-none dark:border-white/10 bg-transparent';

const SELECT_BASE =
  'w-full min-w-0 sm:w-32 sm:min-w-32 sm:max-w-32 sm:shrink-0';

const SELECT_BASE_WIDE =
  'w-full min-w-0 sm:w-44 sm:min-w-44 sm:max-w-44 sm:shrink-0';

const sortSelectClassNames = {
  base: SELECT_BASE_WIDE,
  value: 'font-normal text-foreground',
  selectorIcon: 'text-default-400',
  trigger: BORDERED_FIELD,
} as const;

function filterSelectClassNames(hasValue: boolean, wide = false) {
  return {
    base: wide ? SELECT_BASE_WIDE : SELECT_BASE,
    value: hasValue ? 'font-normal text-foreground' : 'font-normal text-default-500',
    selectorIcon: 'text-default-400',
    trigger: BORDERED_FIELD,
  } as const;
}

function yearChoices() {
  const y = new Date().getFullYear();
  const out: string[] = [];
  for (let i = y + 1; i >= 1920; i -= 1) out.push(String(i));
  return out;
}

export default function SearchCatalogFilters() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const rawSort = searchParams.get('sort_by') || 'relevance';
  const sortBy = SORT_OPTIONS.some((o) => o.key === rawSort) ? rawSort : 'relevance';
  const rawGenre = searchParams.get('genre') || '';
  const genre = imdbGenreSlugFromBrowseParam(rawGenre) ?? rawGenre;
  const yearMin = searchParams.get('year_min') || '';
  const yearMax = searchParams.get('year_max') || '';

  const years = useMemo(() => yearChoices(), []);

  const sortItems: SelectRow[] = useMemo(
    () => SORT_OPTIONS.map((o) => ({ id: o.key, label: o.label })),
    []
  );

  const genreItems: SelectRow[] = useMemo(
    () =>
      (IMDB_GENRES as ImdbGenre[]).map((g) => ({
        id: g.slug,
        label: g.label,
      })),
    []
  );

  const yearItems: SelectRow[] = useMemo(
    () => years.map((y) => ({ id: y, label: y })),
    [years]
  );

  const mergeParams = useCallback(
    (patch: Record<string, string | null | undefined>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [k, v] of Object.entries(patch)) {
        if (!v || (k === 'sort_by' && v === 'relevance')) {
          params.delete(k);
        } else {
          params.set(k, String(v));
        }
      }
      router.push(`${pathname}?${params.toString()}`);
    },
    [pathname, router, searchParams]
  );

  useEffect(() => {
    if (!searchParams.get('type')) return;
    const params = new URLSearchParams(searchParams.toString());
    params.delete('type');
    const next = params.toString();
    router.replace(next ? `${pathname}?${next}` : pathname);
  }, [pathname, router, searchParams]);

  useEffect(() => {
    if (!rawGenre) return;
    const normalized = imdbGenreSlugFromBrowseParam(rawGenre);
    if (normalized && normalized !== rawGenre) {
      mergeParams({ genre: normalized, page: '1' });
    }
  }, [rawGenre, mergeParams]);

  const hasActiveFilters =
    sortBy !== 'relevance' ||
    Boolean(genre) ||
    Boolean(yearMin) ||
    Boolean(yearMax);

  const clearFilters = () =>
    mergeParams({
      sort_by: null,
      genre: null,
      year_min: null,
      year_max: null,
      page: '1',
    });

  return (
    <section className="w-full space-y-2" aria-label="Search filters">
      <div className="flex w-full flex-wrap items-end gap-2">
        <Select<SelectRow>
          aria-label="Sort by"
          placeholder="Sort"
          items={sortItems}
          selectedKeys={new Set([sortBy])}
          onSelectionChange={(keys) => {
            const v = Array.from(keys)[0] as string | undefined;
            if (v) mergeParams({ sort_by: v, page: '1' });
          }}
          size="sm"
          variant="bordered"
          radius="sm"
          classNames={sortSelectClassNames}
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
            if (v) mergeParams({ genre: v, page: '1' });
          }}
          size="sm"
          variant="bordered"
          radius="sm"
          classNames={filterSelectClassNames(Boolean(genre), true)}
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
            if (v) mergeParams({ year_min: v, page: '1' });
          }}
          size="sm"
          variant="bordered"
          radius="sm"
          classNames={filterSelectClassNames(Boolean(yearMin))}
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
            if (v) mergeParams({ year_max: v, page: '1' });
          }}
          size="sm"
          variant="bordered"
          radius="sm"
          classNames={filterSelectClassNames(Boolean(yearMax))}
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
