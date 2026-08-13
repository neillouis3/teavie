"use client";

import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Header from "@/components/ui/header";
import PageBlurredBackdrop from "@/components/ui/pageBlurredBackdrop";
import CatalogGrid from "@/components/browse/catalogGrid";
import CatalogGridLoading from "@/components/browse/skeleton/catalogGridLoading";
import CatalogFilterBar from "@/components/browse/CatalogFilterBar";
import BrowseCatalogSidebar from "@/components/browse/BrowseCatalogSidebar";
import { Spinner } from "@heroui/react";
import type { ContentItem } from "@/types/content";
import {
  bustInflightDayCache,
  browseCatalogCacheKey,
  BROWSE_CATALOG_PAGE_LIMIT,
  fetchBrowseCatalogPayload,
  fetchBrowseCatalogPageResults,
  peekBrowseCatalogCache,
  prefetchBrowseCatalogPage,
} from "@/lib/pageDataCache";
import { CONTENT_INSET_X } from "@/lib/contentInset";
import type { PageBrowseBackdrop } from "@/lib/pageBackdrop";
import { useResumeFetchWhenVisible } from "@/hooks/useResumeFetchWhenVisible";

function inferBrowseHasMore(
  loadedCount: number,
  {
    nextCursor,
    page,
    totalPages,
    total,
    lastBatchSize,
  }: {
    nextCursor: string | null;
    page: number;
    totalPages: number;
    total: number;
    lastBatchSize: number;
  }
): boolean {
  if (nextCursor) return true;
  if (total > 0 && loadedCount < total) return true;
  if (page < totalPages) return true;
  if (
    lastBatchSize >= BROWSE_CATALOG_PAGE_LIMIT &&
    total <= 0 &&
    totalPages <= 1
  ) {
    return true;
  }
  return false;
}

type BrowseCatalogPageProps = {
  pageName: string;
  documentTitle: string;
  namespace: string;
  apiPath: string;
  genreApiPath?: string;
  filterMode: "movie" | "tv" | "anime" | "kdrama";
  viewer: "movie" | "show";
  /** When the URL has no `sort_by`, use this (e.g. anime → most popular). */
  defaultSort?: string;
  backdrop?: PageBrowseBackdrop;
};

function BrowseCatalogPageContent({
  pageName,
  documentTitle,
  namespace,
  apiPath,
  genreApiPath,
  filterMode,
  viewer,
  defaultSort = "rating",
  backdrop = "browse",
}: BrowseCatalogPageProps) {
  const searchParams = useSearchParams();
  const sortParam = searchParams.get("sort_by") || defaultSort;
  const genreParam = searchParams.get("genre") ?? "";
  const yearMinParam = searchParams.get("year_min") ?? "";
  const yearMaxParam = searchParams.get("year_max") ?? "";
  const qParam = searchParams.get("q") ?? "";

  const filterQueryString = useMemo(() => {
    const qs = new URLSearchParams();
    qs.set("limit", String(BROWSE_CATALOG_PAGE_LIMIT));
    qs.set("sort_by", sortParam);
    if (genreParam) qs.set("genre", genreParam);
    if (yearMinParam) qs.set("year_min", yearMinParam);
    if (yearMaxParam) qs.set("year_max", yearMaxParam);
    if (qParam.trim()) qs.set("q", qParam.trim());
    return qs.toString();
  }, [sortParam, genreParam, yearMinParam, yearMaxParam, qParam]);

  const firstPageQuery = useMemo(() => {
    const qs = new URLSearchParams(filterQueryString);
    qs.set("page", "1");
    return qs.toString();
  }, [filterQueryString]);

  const [items, setItems] = useState<ContentItem[]>(() => {
    const cached = peekBrowseCatalogCache(namespace, firstPageQuery);
    return cached?.results ?? [];
  });
  const [totalPages, setTotalPages] = useState(() => {
    const cached = peekBrowseCatalogCache(namespace, firstPageQuery);
    return cached?.totalPages ?? 1;
  });
  const [total, setTotal] = useState(() => {
    const cached = peekBrowseCatalogCache(namespace, firstPageQuery);
    return cached?.total ?? 0;
  });
  const [genreSlugs, setGenreSlugs] = useState<string[] | undefined>(() => {
    const cached = peekBrowseCatalogCache(namespace, firstPageQuery);
    return cached?.genreSlugs;
  });
  const [loading, setLoading] = useState(() => {
    const cached = peekBrowseCatalogCache(namespace, firstPageQuery);
    return !(cached && cached.results.length > 0);
  });
  const [loadFailed, setLoadFailed] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const pageRef = useRef(1);
  const nextCursorRef = useRef<string | null>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const loadingMoreInFlightRef = useRef(false);

  const syncBrowsePagination = useCallback(
    (
      loadedCount: number,
      meta: {
        nextCursor: string | null;
        page: number;
        totalPages: number;
        total: number;
        lastBatchSize: number;
      }
    ) => {
      pageRef.current = meta.page;
      nextCursorRef.current = meta.nextCursor;
      setHasMore(inferBrowseHasMore(loadedCount, meta));
    },
    []
  );

  const warmNextBrowsePage = useCallback(
    (cursor: string | null | undefined, page = 2) => {
      if (cursor) {
        prefetchBrowseCatalogPage(namespace, apiPath, filterQueryString, { after: cursor });
        return;
      }
      prefetchBrowseCatalogPage(namespace, apiPath, filterQueryString, { page });
    },
    [namespace, apiPath, filterQueryString]
  );

  const loadFirstPage = useCallback(() => {
    const query = new URLSearchParams(filterQueryString);
    query.set("page", "1");
    const queryString = query.toString();
    const cached = peekBrowseCatalogCache(namespace, queryString);
    if (!cached?.results.length) {
      setLoading(true);
    }
    setLoadFailed(false);
    return fetchBrowseCatalogPayload(namespace, apiPath, queryString, genreApiPath)
      .then((data) => {
        if (data.ok === false) {
          setLoadFailed(true);
          setItems([]);
          setTotalPages(1);
          setTotal(0);
          return;
        }
        setLoadFailed(false);
        setItems(data.results);
        setTotalPages(data.totalPages);
        setTotal(data.total);
        syncBrowsePagination(data.results.length, {
          nextCursor: data.nextCursor ?? null,
          page: 1,
          totalPages: data.totalPages,
          total: data.total,
          lastBatchSize: data.results.length,
        });
        if (data.genreSlugs) setGenreSlugs(data.genreSlugs);
        if (data.nextCursor) {
          warmNextBrowsePage(data.nextCursor);
        } else if (data.totalPages > 1) {
          warmNextBrowsePage(null, 2);
        }
      })
      .catch(() => {
        setLoadFailed(true);
        setItems([]);
        setTotalPages(1);
        setTotal(0);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [namespace, apiPath, filterQueryString, genreApiPath, warmNextBrowsePage, syncBrowsePagination]);

  const bustBrowseInflight = useCallback(() => {
    const query = new URLSearchParams(filterQueryString);
    query.set("page", "1");
    bustInflightDayCache(browseCatalogCacheKey(namespace, query.toString()));
  }, [namespace, filterQueryString]);

  useEffect(() => {
    document.title = documentTitle;
  }, [documentTitle]);

  useEffect(() => {
    let cancelled = false;
    pageRef.current = 1;
    nextCursorRef.current = null;
    setHasMore(false);

    const queryString = firstPageQuery;
    const cached = peekBrowseCatalogCache(namespace, queryString);
    if (cached?.results.length) {
      setItems(cached.results);
      setTotalPages(cached.totalPages);
      setTotal(cached.total);
      syncBrowsePagination(cached.results.length, {
        nextCursor: cached.nextCursor ?? null,
        page: 1,
        totalPages: cached.totalPages,
        total: cached.total,
        lastBatchSize: cached.results.length,
      });
      if (cached.genreSlugs) setGenreSlugs(cached.genreSlugs);
      setLoading(false);
      setLoadFailed(false);
    } else {
      setItems([]);
      setTotal(0);
      setTotalPages(1);
      setLoading(true);
      setLoadFailed(false);
    }

    void fetchBrowseCatalogPayload(namespace, apiPath, queryString, genreApiPath)
      .then((data) => {
        if (cancelled) return;
        if (data.ok === false) {
          if (!cached?.results.length) {
            setLoadFailed(true);
            setItems([]);
            setTotalPages(1);
            setTotal(0);
            syncBrowsePagination(0, {
              nextCursor: null,
              page: 1,
              totalPages: 1,
              total: 0,
              lastBatchSize: 0,
            });
          }
          return;
        }
        setLoadFailed(false);
        setItems(data.results);
        setTotalPages(data.totalPages);
        setTotal(data.total);
        syncBrowsePagination(data.results.length, {
          nextCursor: data.nextCursor ?? null,
          page: 1,
          totalPages: data.totalPages,
          total: data.total,
          lastBatchSize: data.results.length,
        });
        if (data.genreSlugs) setGenreSlugs(data.genreSlugs);
        if (data.nextCursor) {
          warmNextBrowsePage(data.nextCursor);
        } else if (data.totalPages > 1) {
          warmNextBrowsePage(null, 2);
        }
      })
      .catch(() => {
        if (cancelled) return;
        if (!cached?.results.length) {
          setLoadFailed(true);
          setItems([]);
          setTotalPages(1);
          setTotal(0);
          syncBrowsePagination(0, {
            nextCursor: null,
            page: 1,
            totalPages: 1,
            total: 0,
            lastBatchSize: 0,
          });
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [
    namespace,
    apiPath,
    firstPageQuery,
    filterQueryString,
    genreApiPath,
    warmNextBrowsePage,
    syncBrowsePagination,
  ]);

  useResumeFetchWhenVisible(loading, () => {
    void loadFirstPage();
  }, bustBrowseInflight);

  const loadMore = useCallback(async () => {
    if (loading || loadingMore || loadingMoreInFlightRef.current || !hasMore) {
      return;
    }

    loadingMoreInFlightRef.current = true;
    setLoadingMore(true);
    const loadedBefore = items.length;
    const cursor = nextCursorRef.current;

    const fetchPage = (queryString: string) =>
      fetchBrowseCatalogPageResults(namespace, apiPath, queryString);

    const buildQuery = (opts: { cursor?: string | null; page?: number }) => {
      const query = new URLSearchParams(filterQueryString);
      if (opts.cursor) {
        query.delete("page");
        query.set("after", opts.cursor);
      } else if (opts.page != null) {
        query.set("page", String(opts.page));
      }
      return query.toString();
    };

    try {
      let data = await fetchPage(
        buildQuery({
          cursor,
          page: cursor ? undefined : pageRef.current + 1,
        })
      );

      if (data.results.length === 0 && cursor) {
        data = await fetchPage(
          buildQuery({
            page: Math.max(2, Math.floor(loadedBefore / BROWSE_CATALOG_PAGE_LIMIT) + 1),
          })
        );
      }

      if (data.results.length === 0) {
        syncBrowsePagination(loadedBefore, {
          nextCursor: null,
          page: pageRef.current,
          totalPages: pageRef.current,
          total,
          lastBatchSize: 0,
        });
        return;
      }

      let mergedCount = loadedBefore;
      setItems((current) => {
        const seen = new Set(current.map((item) => `${item.type ?? viewer}:${item.id}`));
        const merged = [
          ...current,
          ...data.results.filter((item) => !seen.has(`${item.type ?? viewer}:${item.id}`)),
        ];
        mergedCount = merged.length;
        return merged;
      });

      if (mergedCount === loadedBefore) {
        syncBrowsePagination(mergedCount, {
          nextCursor: null,
          page: pageRef.current,
          totalPages: pageRef.current,
          total,
          lastBatchSize: 0,
        });
        return;
      }

      const nextPage = cursor ? pageRef.current : pageRef.current + 1;
      const resolvedTotal =
        typeof data.total === "number" ? data.total : total;
      const resolvedTotalPages =
        typeof data.totalPages === "number" ? data.totalPages : totalPages;

      if (!cursor) {
        setTotalPages(resolvedTotalPages);
      }
      if (typeof data.total === "number") {
        setTotal(data.total);
      }

      syncBrowsePagination(mergedCount, {
        nextCursor: data.nextCursor ?? null,
        page: nextPage,
        totalPages: cursor ? totalPages : resolvedTotalPages,
        total: resolvedTotal,
        lastBatchSize: data.results.length,
      });

      if (data.nextCursor) {
        warmNextBrowsePage(data.nextCursor);
      } else if (
        nextPage < resolvedTotalPages &&
        data.results.length >= BROWSE_CATALOG_PAGE_LIMIT
      ) {
        warmNextBrowsePage(null, nextPage + 1);
      }
    } finally {
      loadingMoreInFlightRef.current = false;
      setLoadingMore(false);
    }
  }, [
    apiPath,
    filterQueryString,
    hasMore,
    items.length,
    loading,
    loadingMore,
    namespace,
    syncBrowsePagination,
    total,
    totalPages,
    viewer,
    warmNextBrowsePage,
  ]);

  useEffect(() => {
    const target = loadMoreRef.current;
    if (!target || loading || !hasMore) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) void loadMore();
      },
      { rootMargin: "1200px 0px" }
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [hasMore, items.length, loadMore, loading]);

  return (
    <div className="relative min-h-screen w-full pb-10">
      <PageBlurredBackdrop variant={backdrop} />
      <div className={`relative z-10 ${CONTENT_INSET_X}`}>
        <div className="flex items-start gap-8">
          <BrowseCatalogSidebar
            label={viewer === "movie" ? "Movies" : "Shows"}
            genreSlugs={genreSlugs}
            defaultSort={defaultSort}
          />
          <main className="min-w-0 flex-1">
            <div className="mb-5 flex items-end justify-between gap-4">
              <div>
                <h1 className="text-base font-medium tracking-tight text-white">{pageName}</h1>
                
              </div>
              {!loading ? (
                <span
                  className={`shrink-0 rounded-full bg-white/10 px-4 py-2 text-xs text-white/70 ${total > 0 ? "" : "invisible"}`}
                  aria-hidden={total <= 0}
                >
                  {total > 0 ? `${total.toLocaleString()} titles` : "0 titles"}
                </span>
              ) : (
                <span
                  className="inline-block h-8 w-24 shrink-0 animate-pulse rounded-full bg-default-200 dark:bg-white/10"
                  aria-hidden
                />
              )}
            </div>

            <div className="mb-5 lg:hidden">
              <CatalogFilterBar
                variant="browse"
                genreSlugs={genreSlugs}
                defaultSort={defaultSort}
              />
            </div>

            {loading && items.length === 0 ? (
          <CatalogGridLoading />
        ) : loadFailed && items.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-sm text-default-500">
              Couldn&apos;t load titles right now.
            </p>
            <button
              type="button"
              className="mt-3 text-sm text-success hover:underline"
              onClick={() => {
                bustBrowseInflight();
                void loadFirstPage();
              }}
            >
              Try again
            </button>
          </div>
        ) : items.length === 0 ? (
          <p className="py-16 text-center text-sm text-default-500">
            No titles match these filters. Try adjusting your search.
          </p>
        ) : (
          <>
          <CatalogGrid
            items={items}
            defaultType={viewer === "movie" ? "movie" : "tv"}
          />
          {loading ? (
            <p className="sr-only" aria-live="polite">
              Updating results…
            </p>
          ) : null}
          </>
        )}

            {!loading && items.length > 0 && hasMore ? (
              <div ref={loadMoreRef} className="flex min-h-24 items-center justify-center pt-6">
                {loadingMore ? <Spinner size="sm" color="success" label="Loading more" /> : null}
              </div>
            ) : null}
          </main>
        </div>
      </div>
    </div>
  );
}

function BrowseCatalogPageFallback({
  pageName,
  backdrop = "browse",
}: {
  pageName: string;
  backdrop?: PageBrowseBackdrop;
}) {
  return (
    <div className="relative min-h-screen w-full">
      <PageBlurredBackdrop variant={backdrop} />
      <div className={`relative z-10 pb-8 pt-2 ${CONTENT_INSET_X}`}>
        <Header pageName={pageName} />
        <CatalogGridLoading />
      </div>
    </div>
  );
}

export default function BrowseCatalogPage(props: BrowseCatalogPageProps) {
  return (
    <Suspense
      fallback={
        <BrowseCatalogPageFallback
          pageName={props.pageName}
          backdrop={props.backdrop}
        />
      }
    >
      <BrowseCatalogPageContent {...props} />
    </Suspense>
  );
}
