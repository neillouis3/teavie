"use client";

import React, { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import Header from "@/components/ui/header";
import MovieCatalogGrid from "@/components/browse/movieCatalogGrid";
import ShowCatalogGrid from "@/components/browse/showCatalogGrid";
import MovieCatalogGridLoading from "@/components/browse/skeleton/movieCatalogGridLoading";
import BrowseCatalogFilters from "@/components/browse/BrowseCatalogFilters";
import { Pagination } from "@heroui/react";
import type { ContentItem } from "@/types/content";
import { fetchBrowseCatalogPayload } from "@/lib/pageDataCache";

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
  defaultSort = "title",
}: BrowseCatalogPageProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const rawPage = parseInt(searchParams.get("page") || "1", 10);
  const pageParam = Number.isFinite(rawPage) && rawPage >= 1 ? rawPage : 1;
  const sortParam = searchParams.get("sort_by") || defaultSort;
  const genreParam = searchParams.get("genre") ?? "";
  const yearMinParam = searchParams.get("year_min") ?? "";
  const yearMaxParam = searchParams.get("year_max") ?? "";
  const qParam = searchParams.get("q") ?? "";

  const queryString = useMemo(() => {
    const qs = new URLSearchParams();
    qs.set("page", String(pageParam));
    qs.set("limit", "28");
    qs.set("sort_by", sortParam);
    if (genreParam) qs.set("genre", genreParam);
    if (yearMinParam) qs.set("year_min", yearMinParam);
    if (yearMaxParam) qs.set("year_max", yearMaxParam);
    if (qParam.trim()) qs.set("q", qParam.trim());
    return qs.toString();
  }, [pageParam, sortParam, genreParam, yearMinParam, yearMaxParam, qParam]);

  const [items, setItems] = useState<ContentItem[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [genreSlugs, setGenreSlugs] = useState<string[] | undefined>();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    document.title = documentTitle;
  }, [documentTitle]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    void fetchBrowseCatalogPayload(namespace, apiPath, queryString, genreApiPath)
      .then((data) => {
        if (cancelled) return;
        setItems(data.results);
        setTotalPages(data.totalPages);
        if (data.genreSlugs) setGenreSlugs(data.genreSlugs);
      })
      .catch(() => {
        if (cancelled) return;
        setItems([]);
        setTotalPages(1);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [namespace, apiPath, queryString, genreApiPath]);

  const setPage = (p: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(p));
    router.push(`${pathname}?${params.toString()}`);
  };

  return (
    <div className="bg-main min-h-screen w-full">
      <Header pageName={pageName} />
      <div className="space-y-4 pr-3 pb-8 pt-2 sm:pr-4">
        <BrowseCatalogFilters
          mode={filterMode}
          genreSlugs={genreSlugs}
          defaultSort={defaultSort}
        />

        {backLink ? (
          <p className="text-sm text-default-500">
            <Link href={backLink.href} className="text-success hover:underline">
              {backLink.label}
            </Link>
          </p>
        ) : null}

        {loading ? (
          <MovieCatalogGridLoading />
        ) : items.length === 0 ? (
          <p className="py-16 text-center text-sm text-default-500">
            No titles match these filters. Try adjusting your search.
          </p>
        ) : viewer === "movie" ? (
          <MovieCatalogGrid items={items} />
        ) : (
          <ShowCatalogGrid items={items} />
        )}

        {totalPages > 1 && !loading && items.length > 0 ? (
          <div className="flex justify-center pt-2">
            <Pagination
              total={totalPages}
              page={pageParam}
              onChange={setPage}
              showControls
              size="sm"
              color="default"
              variant="light"
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}

function BrowseCatalogPageFallback({ pageName }: { pageName: string }) {
  return (
    <div className="bg-main min-h-screen w-full">
      <Header pageName={pageName} />
      <div className="pr-3 pb-8 pt-2 sm:pr-4">
        <MovieCatalogGridLoading />
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
