'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { Input, Button, Select, SelectItem, Chip } from '@heroui/react';
import { MagnifyingGlassIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { TMDB_MOVIE_GENRES, TMDB_TV_GENRES } from '@/lib/tmdbGenres';

const SORT_OPTIONS = [
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

/** Fixed trigger width (8rem) per design */
const SELECT_BASE = 'w-32 min-w-32 max-w-32 shrink-0';

const sortSelectClassNames = {
  base: SELECT_BASE,
  value: 'font-normal text-foreground',
  selectorIcon: 'text-default-400',
  trigger: BORDERED_FIELD,
} as const;

function filterSelectClassNames(hasValue: boolean) {
  return {
    base: SELECT_BASE,
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

type BrowseCatalogFiltersProps = {
  mode: 'movie' | 'tv';
  total: number;
  loading: boolean;
};

export default function BrowseCatalogFilters({
  mode,
  total,
  loading,
}: BrowseCatalogFiltersProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const rawSort = searchParams.get('sort_by') || 'title';
  const sortBy = SORT_OPTIONS.some((o) => o.key === rawSort) ? rawSort : 'title';
  const genre = searchParams.get('genre') || '';
  const yearMin = searchParams.get('year_min') || '';
  const yearMax = searchParams.get('year_max') || '';
  const qUrl = searchParams.get('q') || '';

  const [searchDraft, setSearchDraft] = useState(qUrl);
  useEffect(() => {
    setSearchDraft(qUrl);
  }, [qUrl]);

  const years = useMemo(() => yearChoices(), []);

  const sortItems: SelectRow[] = useMemo(
    () => SORT_OPTIONS.map((o) => ({ id: o.key, label: o.label })),
    []
  );

  const genreItems: SelectRow[] = useMemo(() => {
    const list = mode === 'movie' ? TMDB_MOVIE_GENRES : TMDB_TV_GENRES;
    return list.map((g) => ({ id: String(g.id), label: g.name }));
  }, [mode]);

  const yearItems: SelectRow[] = useMemo(
    () => years.map((y) => ({ id: y, label: y })),
    [years]
  );

  const mergeParams = useCallback(
    (patch: Record<string, string | null | undefined>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [k, v] of Object.entries(patch)) {
        if (!v) params.delete(k);
        else params.set(k, String(v));
      }
      router.push(`${pathname}?${params.toString()}`);
    },
    [pathname, router, searchParams]
  );

  const hasActiveFilters =
    Boolean(genre) || Boolean(yearMin) || Boolean(yearMax) || Boolean(qUrl.trim());

  const clearFilters = () =>
    mergeParams({ genre: null, year_min: null, year_max: null, q: null, page: '1' });

  const onSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mergeParams({ q: searchDraft.trim() || null, page: '1' });
  };

  const countLabel = loading ? 'Loading…' : `${total.toLocaleString()} titles`;

  const searchPlaceholder = 'Search titles…';

  return (
    <section className="mb-4 w-full space-y-3" aria-label="Browse">
      <form onSubmit={onSearchSubmit} className="w-full">
        <Input
          aria-label="Search titles"
          placeholder={searchPlaceholder}
          value={searchDraft}
          onValueChange={setSearchDraft}
          size="sm"
          variant="flat"
          radius="sm"
          className="w-full"
          startContent={<MagnifyingGlassIcon className="h-4 w-4 shrink-0 text-default-400" />}
          classNames={{
            base: 'w-full',
            input: 'text-sm',
            inputWrapper: 'h-9 w-full bg-default-100 hover:bg-default-200',
          }}
        />
      </form>

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
          classNames={filterSelectClassNames(Boolean(genre))}
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
          startContent={<XMarkIcon className="h-3.5 w-3.5" />}
          onPress={clearFilters}
        >
          Clear
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Chip color="success" size="md" radius="sm" variant="flat">
          {countLabel}
        </Chip>
      </div>
    </section>
  );
}
