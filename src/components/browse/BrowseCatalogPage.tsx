"use client";

import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import Header from "@/components/ui/header";
import CatalogGrid from "@/components/browse/catalogGrid";
import CatalogGridLoading from "@/components/browse/skeleton/catalogGridLoading";
import CatalogFilterBar from "@/components/browse/CatalogFilterBar";
import BrowseCatalogSidebar from "@/components/browse/BrowseCatalogSidebar";
import { Spinner } from "@heroui/react";
import type { ContentItem } from "@/types/content";
import {
  bustInflightDayCache,
  browseCatalogCacheKey,
  fetchBrowseCatalogPayload,
  fetchBrowseCatalogPageResults,
  peekBrowseCatalogCache,
  prefetchBrowseCatalogPage,
} from "@/lib/pageDataCache";
import { CONTENT_INSET_X } from "@/lib/contentInset";
import { useResumeFetchWhenVisible } from "@/hooks/useResumeFetchWhenVisible";

type BrowseCatalogPageProps = {
  pageName: string;
  documentTitle: string;
  namespace: string;
  apiPath: string;
  genreApiPath?: string;
  filterMode: "movie" | "tv" | "anime" | "kdrama";
  viewer: "movie" | "show";
  backLink?: { href: string; label: string };
  /** When the URL has no `sort_by`, use this (e.g. anime → most popular). */
  defaultSort?: string;
};

function BrowseCatalogPageContent({
  pageName,
  documentTitle,
  namespace,
  apiPath,
  genreApiPath,
  filterMode,
  viewer,
  backLink,
  defaultSort = "rating",
}: BrowseCatalogPageProps) {
  const searchParams = useSearchParams();
  const sortParam = searchParams.get("sort_by") || defaultSort;
  const genreParam = searchParams.get("genre") ?? "";
  const yearMinParam = searchParams.get("year_min") ?? "";
  const yearMaxParam = searchParams.get("year_max") ?? "";
  const qParam = searchParams.get("q") ?? "";

  const filterQueryString = useMemo(() => {
    const qs = new URLSearchParams();
    qs.set("limit", "28");
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
  const pageRef = useRef(1);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const loadingMoreInFlightRef = useRef(false);

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
        if (data.genreSlugs) setGenreSlugs(data.genreSlugs);
        if (data.totalPages > 1) {
          prefetchBrowseCatalogPage(namespace, apiPath, filterQueryString, 2);
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
  }, [namespace, apiPath, filterQueryString, genreApiPath]);

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

    const queryString = firstPageQuery;
    const cached = peekBrowseCatalogCache(namespace, queryString);
    if (cached?.results.length) {
      setItems(cached.results);
      setTotalPages(cached.totalPages);
      setTotal(cached.total);
      if (cached.genreSlugs) setGenreSlugs(cached.genreSlugs);
      setLoading(false);
      setLoadFailed(false);
    } else {
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
          }
          return;
        }
        setLoadFailed(false);
        setItems(data.results);
        setTotalPages(data.totalPages);
        setTotal(data.total);
        if (data.genreSlugs) setGenreSlugs(data.genreSlugs);
        if (data.totalPages > 1) {
          prefetchBrowseCatalogPage(namespace, apiPath, filterQueryString, 2);
        }
      })
      .catch(() => {
        if (cancelled) return;
        if (!cached?.results.length) {
          setLoadFailed(true);
          setItems([]);
          setTotalPages(1);
          setTotal(0);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [namespace, apiPath, firstPageQuery, filterQueryString, genreApiPath]);

  useResumeFetchWhenVisible(loading, () => {
    void loadFirstPage();
  }, bustBrowseInflight);

  const loadMore = useCallback(async () => {
    if (
      loading ||
      loadingMore ||
      loadingMoreInFlightRef.current ||
      pageRef.current >= totalPages
    ) {
      return;
    }

    loadingMoreInFlightRef.current = true;
    setLoadingMore(true);
    const nextPage = pageRef.current + 1;
    const query = new URLSearchParams(filterQueryString);
    query.set("page", String(nextPage));

    try {
      const data = await fetchBrowseCatalogPageResults(
        namespace,
        apiPath,
        query.toString()
      );
      if (data.results.length === 0) return;

      setItems((current) => {
        const seen = new Set(current.map((item) => `${item.type ?? viewer}:${item.id}`));
        return [
          ...current,
          ...data.results.filter((item) => !seen.has(`${item.type ?? viewer}:${item.id}`)),
        ];
      });
      pageRef.current = nextPage;
      if (typeof data.totalPages === "number") setTotalPages(data.totalPages);
      if (typeof data.total === "number") setTotal(data.total);
      if (data.results.length < 28) {
        setTotalPages(nextPage);
      } else if (nextPage < totalPages) {
        prefetchBrowseCatalogPage(
          namespace,
          apiPath,
          filterQueryString,
          nextPage + 1
        );
      }
    } finally {
      loadingMoreInFlightRef.current = false;
      setLoadingMore(false);
    }
  }, [apiPath, filterQueryString, loading, loadingMore, namespace, totalPages, viewer]);

  useEffect(() => {
    const target = loadMoreRef.current;
    if (!target || loading || pageRef.current >= totalPages) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) void loadMore();
      },
      { rootMargin: "700px 0px" }
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [items.length, loadMore, loading, totalPages]);

  return (
    <div className="bg-main min-h-screen w-full">
      <div className={`pb-10 ${CONTENT_INSET_X}`}>
        <div className="flex items-start gap-8">
          <BrowseCatalogSidebar
            label={viewer === "movie" ? "Movies" : "Shows"}
            genreSlugs={genreSlugs}
            defaultSort={defaultSort}
          />
          <main className="min-w-0 flex-1">
            <div className="mb-5 flex items-end justify-between gap-4">
              <div>
                <h1 className="text-base tracking-tight text-foreground">{pageName}</h1>
                
              </div>
              {!loading ? (
                <span
                  className={`shrink-0 rounded-full bg-foreground/8 px-4 py-2 text-xs text-default-500 dark:bg-white/8 ${total > 0 ? "" : "invisible"}`}
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

            {backLink ? (
          <p className="text-sm text-default-500">
            <Link href={backLink.href} className="text-success hover:underline">
              {backLink.label}
            </Link>
          </p>
        ) : null}

            {loading ? (
          <CatalogGridLoading />
        ) : loadFailed ? (
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
          <CatalogGrid
            items={items}
            defaultType={viewer === "movie" ? "movie" : "tv"}
          />
        )}

            {!loading && items.length > 0 ? (
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

function BrowseCatalogPageFallback({ pageName }: { pageName: string }) {
  return (
    <div className="bg-main min-h-screen w-full">
      <Header pageName={pageName} />
      <div className={`pb-8 pt-2 ${CONTENT_INSET_X}`}>
        <CatalogGridLoading />
      </div>
    </div>
  );
}

export default function BrowseCatalogPage(props: BrowseCatalogPageProps) {
  return (
    <Suspense fallback={<BrowseCatalogPageFallback pageName={props.pageName} />}>
      <BrowseCatalogPageContent {...props} />
    </Suspense>
  );
}
