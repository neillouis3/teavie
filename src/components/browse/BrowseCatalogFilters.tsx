'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  useSearchParams,
  useRouter,
  usePathname,
} from 'next/navigation';
import {
  Card,
  CardBody,
  CardHeader,
  Input,
  Button,
  Select,
  SelectItem,
  Chip,
  Divider,
} from '@heroui/react';
import { MagnifyingGlassIcon, XMarkIcon } from '@heroicons/react/24/outline';
import {
  TMDB_MOVIE_GENRES,
  TMDB_TV_GENRES,
} from '@/lib/tmdbGenres';

const SORT_OPTIONS = [
  { key: 'title', label: 'Title A–Z' },
  { key: 'title_desc', label: 'Title Z–A' },
  { key: 'release_year', label: 'Newest first' },
  { key: 'release_year_asc', label: 'Oldest first' },
  { key: 'popularity', label: 'Most popular' },
  { key: 'runtime_desc', label: 'Longest runtime' },
  { key: 'runtime_asc', label: 'Shortest runtime' },
] as const;

type SelectRow = { id: string; label: string };

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
  const sortBy = SORT_OPTIONS.some((o) => o.key === rawSort)
    ? rawSort
    : 'title';
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
    const rows: SelectRow[] = [{ id: 'all', label: 'All genres' }];
    for (const g of list) {
      rows.push({ id: String(g.id), label: g.name });
    }
    return rows;
  }, [mode]);

  const yearItems: SelectRow[] = useMemo(() => {
    const rows: SelectRow[] = [{ id: 'all', label: 'Any' }];
    for (const y of years) rows.push({ id: y, label: y });
    return rows;
  }, [years]);

  const mergeParams = useCallback(
    (patch: Record<string, string | null | undefined>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [k, v] of Object.entries(patch)) {
        if (v === null || v === undefined || v === '') {
          params.delete(k);
        } else {
          params.set(k, String(v));
        }
      }
      router.push(`${pathname}?${params.toString()}`);
    },
    [pathname, router, searchParams]
  );

  const hasActiveFilters = useMemo(
    () =>
      Boolean(genre) ||
      Boolean(yearMin) ||
      Boolean(yearMax) ||
      Boolean(qUrl.trim()),
    [genre, yearMin, yearMax, qUrl]
  );

  const clearFilters = () => {
    mergeParams({
      genre: null,
      year_min: null,
      year_max: null,
      q: null,
      page: '1',
    });
  };

  const onSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mergeParams({
      q: searchDraft.trim() || null,
      page: '1',
    });
  };

  const title = mode === 'movie' ? 'Movies' : 'TV shows';
  const subtitle =
    mode === 'movie'
      ? 'Sort, filter by genre or year, or search by title.'
      : 'Sort, filter by genre or first-air year, or search by name.';

  return (
    <Card
      shadow="sm"
      className="mb-6 w-full border border-default-200/60 bg-content1/40 backdrop-blur-sm"
    >
      <CardHeader className="flex flex-col items-start gap-3 pb-0 pt-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">
            Browse {title}
          </h2>
          <p className="text-small text-default-500">{subtitle}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Chip
            color="success"
            variant="flat"
            size="md"
            radius="sm"
            classNames={{ content: 'font-medium' }}
          >
            {loading ? 'Loading…' : `${total.toLocaleString()} in library`}
          </Chip>
          {hasActiveFilters && (
            <Button
              size="sm"
              variant="flat"
              color="default"
              startContent={<XMarkIcon className="h-4 w-4" />}
              onPress={clearFilters}
            >
              Clear filters
            </Button>
          )}
        </div>
      </CardHeader>
      <CardBody className="gap-5 pt-4">
        <form
          onSubmit={onSearchSubmit}
          className="flex w-full flex-col gap-3 sm:flex-row sm:items-end"
        >
          <Input
            aria-label={`Search ${title.toLowerCase()}`}
            label="Search"
            placeholder={`Search ${mode === 'movie' ? 'movie titles' : 'show names'}…`}
            value={searchDraft}
            onValueChange={setSearchDraft}
            variant="bordered"
            radius="lg"
            classNames={{
              base: 'flex-1 w-full',
              inputWrapper: 'bg-default-100/50',
            }}
            startContent={
              <MagnifyingGlassIcon className="h-5 w-5 text-default-400" />
            }
          />
          <Button
            type="submit"
            color="success"
            radius="lg"
            className="w-full shrink-0 sm:w-auto"
          >
            Search
          </Button>
        </form>

        <Divider className="bg-default-200/80" />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Select<SelectRow>
            label="Sort by"
            placeholder="Choose order"
            items={sortItems}
            selectedKeys={new Set([sortBy])}
            onSelectionChange={(keys) => {
              const v = Array.from(keys)[0] as string | undefined;
              if (v) mergeParams({ sort_by: v, page: '1' });
            }}
            variant="bordered"
            radius="lg"
            classNames={{
              trigger: 'bg-default-100/50',
            }}
          >
            {(item) => (
              <SelectItem key={item.id} textValue={item.label}>
                {item.label}
              </SelectItem>
            )}
          </Select>

          <Select<SelectRow>
            label="Genre"
            placeholder="All genres"
            items={genreItems}
            selectedKeys={new Set([genre || 'all'])}
            onSelectionChange={(keys) => {
              const v = Array.from(keys)[0] as string | undefined;
              if (!v) return;
              mergeParams({
                genre: v === 'all' ? null : v,
                page: '1',
              });
            }}
            variant="bordered"
            radius="lg"
            classNames={{
              trigger: 'bg-default-100/50',
            }}
          >
            {(item) => (
              <SelectItem key={item.id} textValue={item.label}>
                {item.label}
              </SelectItem>
            )}
          </Select>

          <Select<SelectRow>
            label="Year from"
            placeholder="Any"
            items={yearItems}
            selectedKeys={new Set([yearMin || 'all'])}
            onSelectionChange={(keys) => {
              const v = Array.from(keys)[0] as string | undefined;
              if (!v) return;
              mergeParams({
                year_min: v === 'all' ? null : v,
                page: '1',
              });
            }}
            variant="bordered"
            radius="lg"
            classNames={{
              trigger: 'bg-default-100/50',
            }}
          >
            {(item) => (
              <SelectItem key={item.id} textValue={item.label}>
                {item.label}
              </SelectItem>
            )}
          </Select>

          <Select<SelectRow>
            label="Year to"
            placeholder="Any"
            items={yearItems}
            selectedKeys={new Set([yearMax || 'all'])}
            onSelectionChange={(keys) => {
              const v = Array.from(keys)[0] as string | undefined;
              if (!v) return;
              mergeParams({
                year_max: v === 'all' ? null : v,
                page: '1',
              });
            }}
            variant="bordered"
            radius="lg"
            classNames={{
              trigger: 'bg-default-100/50',
            }}
          >
            {(item) => (
              <SelectItem key={item.id} textValue={item.label}>
                {item.label}
              </SelectItem>
            )}
          </Select>
        </div>
      </CardBody>
    </Card>
  );
}
