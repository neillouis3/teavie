'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { Chip, Pagination } from '@heroui/react';
import { HugeiconsIcon } from '@hugeicons/react';
import { StarIcon } from '@hugeicons/core-free-icons';
import Header from '@/components/ui/header';
import type { ContentItem } from '@/types/content';
import { genreFeaturedGradient, genrePageDescription } from '@/lib/genrePageCopy';
import SmallCard from '@/components/ui/smallCard';
import HorizontalCatalogCard from '@/components/ui/horizontalCatalogCard';
import SmallCardLoading from '@/components/ui/smallCardLoading';
import HorizontalCatalogCardLoading from '@/components/ui/horizontalCatalogCardLoading';
import {
  useCatalogCardStyle,
  type CatalogCardLayoutMode,
} from '@/contexts/catalogCardStyleContext';
import {
  CATALOG_GRID_HORIZONTAL_SEARCH,
  CATALOG_GRID_VERTICAL_SEARCH,
} from '@/lib/catalogGrid';

export type GenrePageType = 'all' | 'movie' | 'tv';
export type GenrePageSort = 'popular' | 'top_rated' | 'new';

const TYPE_OPTIONS: { key: GenrePageType; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'movie', label: 'Movies' },
  { key: 'tv', label: 'TV Shows' },
];

const SORT_OPTIONS: { key: GenrePageSort; label: string }[] = [
  { key: 'popular', label: 'Popular' },
  { key: 'top_rated', label: 'Top rated' },
  { key: 'new', label: 'New' },
];

const TMDB_POSTER = 'https://image.tmdb.org/t/p/w500';
const TMDB_BACKDROP = 'https://image.tmdb.org/t/p/w780';

function posterSrc(path: string | null | undefined) {
  if (!path?.trim()) return null;
  return /^https?:\/\//i.test(path) ? path : `${TMDB_POSTER}${path}`;
}

function backdropSrc(path: string | null | undefined, fallbackPoster?: string | null) {
  const b = path?.trim();
  if (b) return /^https?:\/\//i.test(b) ? b : `${TMDB_BACKDROP}${b}`;
  return posterSrc(fallbackPoster);
}

function itemTitle(item: ContentItem) {
  return item.title || item.name || 'Untitled';
}

function itemTypeLabel(item: ContentItem) {
  return item.type === 'tv' ? 'TV show' : 'Movie';
}

function itemHref(item: ContentItem) {
  const id = item.id;
  return item.type === 'tv' ? `/shows/${id}` : `/movies/${id}`;
}

function formatRating(v: number | null | undefined) {
  if (v == null || !Number.isFinite(v) || v <= 0) return null;
  return v.toFixed(1);
}

function gridClass(layoutMode: CatalogCardLayoutMode) {
  return layoutMode === 'horizontal'
    ? CATALOG_GRID_HORIZONTAL_SEARCH
    : CATALOG_GRID_VERTICAL_SEARCH;
}

function itemYear(item: ContentItem) {
  const raw = item.release_date || item.first_air_date || '';
  return raw.length >= 4 ? raw.slice(0, 4) : '—';
}

function FeaturedCard({
  item,
  gradient,
}: {
  item: ContentItem;
  gradient: string;
}) {
  const title = itemTitle(item);
  const year = itemYear(item);
  const rating = formatRating(item.vote_average);
  const image = backdropSrc(item.backdrop_path, item.poster_path);
  const href = itemHref(item);

  return (
    <Link
      href={href}
      className="group relative flex min-h-[220px] flex-1 overflow-hidden rounded-2xl sm:min-h-[260px]"
    >
      {image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={image}
          alt=""
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
        />
      ) : (
        <span
          className={`absolute inset-0 bg-gradient-to-br ${gradient}`}
          aria-hidden
        />
      )}
      <span className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-black/10" />
      {rating ? (
        <span className="absolute right-4 top-4 inline-flex items-center gap-1 rounded-full bg-black/45 px-2.5 py-1 text-xs font-medium text-white backdrop-blur-sm">
          <HugeiconsIcon icon={StarIcon} size={12} className="text-warning" />
          {rating}
        </span>
      ) : null}
      <div className="relative mt-auto p-5 sm:p-6">
        <p className="text-xs font-medium text-white/70">
          {itemTypeLabel(item)} · {year}
        </p>
        <h3 className="mt-1 text-2xl font-semibold tracking-tight text-white sm:text-[1.65rem]">
          {title}
        </h3>
      </div>
    </Link>
  );
}

function FeaturedSkeleton() {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {Array.from({ length: 2 }).map((_, i) => (
        <div
          key={i}
          className="min-h-[220px] animate-pulse rounded-2xl bg-default-200 sm:min-h-[260px]"
        />
      ))}
    </div>
  );
}

function GenreCardGrid({
  items,
  layoutMode,
}: {
  items: ContentItem[];
  layoutMode: CatalogCardLayoutMode;
}) {
  const horizontal = layoutMode === 'horizontal';

  return (
    <div className={gridClass(layoutMode)}>
      {items.map((item, index) => {
        const title = item.title || item.name || 'Untitled';
        const id = item.id;
        const type = item.type || 'movie';
        const poster = item.poster_path || '';

        if (horizontal) {
          return (
            <HorizontalCatalogCard
              key={`${type}-${item.id}-${index}`}
              id={id}
              title={title}
              year={itemYear(item)}
              type={type}
              posterPath={poster}
              backdropPath={item.backdrop_path || ''}
            />
          );
        }

        return (
          <SmallCard
            key={`${type}-${item.id}-${index}`}
            id={id}
            title={title}
            year={itemYear(item)}
            type={type}
            runtimeSeconds={item.runtimeSeconds ?? undefined}
            seasonAmount={item.season_amount ?? 0}
            numberOfEpisodes={item.number_of_episodes ?? undefined}
            posterPath={poster}
          />
        );
      })}
    </div>
  );
}

function GenreCardGridSkeleton({
  count,
  layoutMode,
}: {
  count: number;
  layoutMode: CatalogCardLayoutMode;
}) {
  const horizontal = layoutMode === 'horizontal';
  const S = horizontal ? HorizontalCatalogCardLoading : SmallCardLoading;

  return (
    <div className={gridClass(layoutMode)}>
      {Array.from({ length: count }).map((_, i) => (
        <S key={i} />
      ))}
    </div>
  );
}

function Pill({
  active,
  filled,
  onClick,
  children,
}: {
  active: boolean;
  filled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
        filled && active
          ? 'bg-white text-black'
          : active
            ? 'border border-white/90 text-foreground'
            : 'border border-default-300/80 text-default-500 hover:border-default-400 hover:text-foreground dark:border-white/15'
      }`}
    >
      {children}
    </button>
  );
}

type GenrePageTemplateProps = {
  slug: string;
  genreLabel: string;
};

export default function GenrePageTemplate({ slug, genreLabel }: GenrePageTemplateProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { mode: cardLayout } = useCatalogCardStyle();

  const rawPage = parseInt(searchParams.get('page') || '1', 10);
  const pageParam = Number.isFinite(rawPage) && rawPage >= 1 ? rawPage : 1;
  const rawType = searchParams.get('type') || 'all';
  const type: GenrePageType =
    rawType === 'movie' || rawType === 'tv' ? rawType : 'all';
  const rawSort = searchParams.get('sort') || 'popular';
  const sort: GenrePageSort =
    rawSort === 'top_rated' || rawSort === 'new' ? rawSort : 'popular';

  const [items, setItems] = useState<ContentItem[]>([]);
  const [featured, setFeatured] = useState<ContentItem[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  const description = useMemo(() => genrePageDescription(genreLabel), [genreLabel]);

  useEffect(() => {
    document.title = `${genreLabel} - Teavie`;
  }, [genreLabel]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);

    const qs = new URLSearchParams();
    qs.set('slug', slug);
    qs.set('page', String(pageParam));
    qs.set('limit', '28');
    if (type !== 'all') qs.set('type', type);
    if (sort !== 'popular') qs.set('sort', sort);

    fetch(`/api/genre?${qs.toString()}`, { signal: controller.signal })
      .then((res) => res.json())
      .then((data) => {
        setItems(data.results ?? []);
        setFeatured(Array.isArray(data.featured) ? data.featured : []);
        setTotal(typeof data.total === 'number' ? data.total : 0);
        setTotalPages(data.totalPages ?? 1);
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setItems([]);
          setFeatured([]);
          setTotal(0);
          setTotalPages(1);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [slug, type, sort, pageParam]);

  const mergeParams = useCallback(
    (patch: Record<string, string | null | undefined>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [k, v] of Object.entries(patch)) {
        if (!v || (k === 'type' && v === 'all') || (k === 'sort' && v === 'popular')) {
          params.delete(k);
        } else {
          params.set(k, String(v));
        }
      }
      router.push(`${pathname}?${params.toString()}`);
    },
    [pathname, router, searchParams]
  );

  const countLabel = loading ? '…' : `${total.toLocaleString()} titles`;

  const showFeatured = pageParam === 1 && sort === 'popular';

  return (
    <div className="bg-main min-h-screen w-full">
      <Header pageName={genreLabel} />
      <div className="w-full space-y-4 px-3 pb-12 pt-2 sm:px-4">
        <div className="space-y-2">
          <Chip color="success" variant="flat" size="md" radius="sm">
            {countLabel}
          </Chip>
          <p className="text-left text-sm leading-relaxed text-default-500 sm:text-[15px]">
            {description}
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-start">
          <div className="flex flex-wrap gap-2">
            {TYPE_OPTIONS.map((opt) => (
              <Pill
                key={opt.key}
                active={type === opt.key}
                filled
                onClick={() => mergeParams({ type: opt.key, page: '1' })}
              >
                {opt.label}
              </Pill>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {SORT_OPTIONS.map((opt) => (
              <Pill
                key={opt.key}
                active={sort === opt.key}
                onClick={() => mergeParams({ sort: opt.key, page: '1' })}
              >
                {opt.label}
              </Pill>
            ))}
          </div>
        </div>

        {(loading || featured.length > 0) && showFeatured ? (
          <section className="mt-6 space-y-3" aria-label="Featured">
            <Chip color="success" variant="flat" size="md" radius="sm">
              Featured
            </Chip>
            {loading ? (
              <FeaturedSkeleton />
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {featured.map((item, i) => (
                  <FeaturedCard
                    key={`${item.type}-${item.id}`}
                    item={item}
                    gradient={genreFeaturedGradient(genreLabel, i)}
                  />
                ))}
              </div>
            )}
          </section>
        ) : null}

        <section className="mt-6 space-y-3" aria-label="All titles">
          <Chip color="success" variant="flat" size="md" radius="sm">
            All titles
          </Chip>

          {loading ? (
            <GenreCardGridSkeleton count={28} layoutMode={cardLayout} />
          ) : items.length === 0 ? (
            <p className="py-16 text-left text-sm text-default-500">
              No titles found for {genreLabel}. Try another filter.
            </p>
          ) : (
            <GenreCardGrid items={items} layoutMode={cardLayout} />
          )}

          {totalPages > 1 && !loading && items.length > 0 && (
            <div className="flex justify-start pt-8">
              <Pagination
                total={totalPages}
                page={pageParam}
                onChange={(p) => mergeParams({ page: p > 1 ? String(p) : null })}
                showControls
                size="sm"
                color="default"
                variant="light"
              />
            </div>
          )}
        </section>

        <p className="mt-10 text-left text-xs text-default-400">
          <Link href="/genres" className="hover:text-success hover:underline">
            Browse all genres
          </Link>
        </p>
      </div>
    </div>
  );
}
