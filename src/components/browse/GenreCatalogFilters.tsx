'use client';

import React, { useCallback, useMemo } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { Input, Button, Select, SelectItem } from '@heroui/react';
import { HugeiconsIcon } from '@hugeicons/react';
import { Search01Icon, Cancel01Icon } from '@hugeicons/core-free-icons';
import ExploreSectionTitle from '@/components/explore/exploreSectionTitle';

const TYPE_OPTIONS = [
  { key: 'movie', label: 'Movies' },
  { key: 'tv', label: 'TV Shows' },
  { key: 'anime', label: 'Anime' },
  { key: 'kdrama', label: 'K-Drama' },
] as const;

export type GenreBrowseType = (typeof TYPE_OPTIONS)[number]['key'];

const SORT_OPTIONS = [
  { key: 'popularity', label: 'Most popular' },
  { key: 'title', label: 'Title A-Z' },
  { key: 'title_desc', label: 'Title Z-A' },
  { key: 'release_year', label: 'Newest first' },
  { key: 'release_year_asc', label: 'Oldest first' },
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

type GenreCatalogFiltersProps = {
  genreLabel: string;
  searchDraft: string;
  onSearchDraftChange: (v: string) => void;
  onSearchSubmit: (e: React.FormEvent) => void;
};

export default function GenreCatalogFilters({
  genreLabel,
  searchDraft,
  onSearchDraftChange,
  onSearchSubmit,
}: GenreCatalogFiltersProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const rawType = searchParams.get('type') || 'movie';
  const type: GenreBrowseType = TYPE_OPTIONS.some((o) => o.key === rawType)
    ? (rawType as GenreBrowseType)
    : 'movie';
  const rawSort = searchParams.get('sort_by') || 'popularity';
  const sortBy = SORT_OPTIONS.some((o) => o.key === rawSort) ? rawSort : 'popularity';
  const yearMin = searchParams.get('year_min') || '';
  const yearMax = searchParams.get('year_max') || '';
  const qUrl = searchParams.get('q') || '';

  const years = useMemo(() => yearChoices(), []);

  const sortItems: SelectRow[] = useMemo(
    () => SORT_OPTIONS.map((o) => ({ id: o.key, label: o.label })),
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
        if (!v || (k === 'type' && v === 'movie') || (k === 'sort_by' && v === 'popularity')) {
          params.delete(k);
        } else {
          params.set(k, String(v));
        }
      }
      router.push(`${pathname}?${params.toString()}`);
    },
    [pathname, router, searchParams]
  );

  const hasActiveFilters =
    type !== 'movie' ||
    sortBy !== 'popularity' ||
    Boolean(yearMin) ||
    Boolean(yearMax) ||
    Boolean(qUrl.trim());

  const clearFilters = () =>
    mergeParams({
      type: null,
      sort_by: null,
      year_min: null,
      year_max: null,
      q: null,
      page: '1',
    });

  const typeLabel = TYPE_OPTIONS.find((o) => o.key === type)?.label ?? 'Titles';

  return (
    <section className="mb-4 w-full space-y-3" aria-label={`${genreLabel} browse`}>
      <div className="flex flex-row flex-wrap items-center justify-between gap-2">
        <ExploreSectionTitle>{genreLabel}</ExploreSectionTitle>

        <div className="inline-flex rounded-lg border border-default-200 p-0.5 dark:border-white/10">
          {TYPE_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              type="button"
              onClick={() => mergeParams({ type: opt.key, page: '1' })}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                type === opt.key
                  ? 'bg-success text-success-foreground shadow-sm'
                  : 'text-default-500 hover:text-foreground'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <form onSubmit={onSearchSubmit} className="w-full">
        <Input
          aria-label={`Search ${genreLabel} ${typeLabel.toLowerCase()}`}
          placeholder={`Search ${typeLabel.toLowerCase()}…`}
          value={searchDraft}
          onValueChange={onSearchDraftChange}
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

export function genreBrowseApiPath(type: GenreBrowseType): string {
  switch (type) {
    case 'anime':
      return '/api/anime';
    case 'kdrama':
      return '/api/kdrama';
    case 'tv':
      return '/api/tv';
    case 'movie':
    default:
      return '/api/movies';
  }
}

export function genreBrowseTypeLabel(type: GenreBrowseType): string {
  return TYPE_OPTIONS.find((o) => o.key === type)?.label ?? 'Titles';
}
