"use client";

import React, { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import Header from "@/components/ui/header";
import PageSplash from "@/components/ui/pageSplash";
import AllMovieViewer from "@/components/viewer/allMoviesViewer";
import AllShowsViewer from "@/components/viewer/allShowsViewer";
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
}: BrowseCatalogPageProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const rawPage = parseInt(searchParams.get("page") || "1", 10);
  const pageParam = Number.isFinite(rawPage) && rawPage >= 1 ? rawPage : 1;
  const sortParam = searchParams.get("sort_by") || "title";
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
  const [total, setTotal] = useState(0);
  const [genreSlugs, setGenreSlugs] = useState<string[] | undefined>();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    document.title = documentTitle;
  }, [documentTitle]);

  useEffect(() => {
    let cancelled = false;
    setReady(false);

    void fetchBrowseCatalogPayload(
      namespace,
      apiPath,
      queryString,
      genreApiPath
    ).then((data) => {
      if (cancelled) return;
      setItems(data.results);
      setTotalPages(data.totalPages);
      setTotal(data.total);
      if (data.genreSlugs) setGenreSlugs(data.genreSlugs);
      setReady(true);
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

  if (!ready) {
    return <PageSplash ariaLabel={`Loading ${pageName}`} />;
  }

  return (
    <div className="bg-main min-h-screen w-full">
      <Header pageName={pageName} />
      <div className="space-y-4 px-3 pb-8 pt-2 sm:px-4">
        <BrowseCatalogFilters
          mode={filterMode}
          total={total}
          loading={false}
          genreSlugs={genreSlugs}
        />

        {backLink ? (
          <p className="text-sm text-default-500">
            <Link href={backLink.href} className="text-success hover:underline">
              {backLink.label}
            </Link>
          </p>
        ) : null}

        {items.length === 0 ? (
          <p className="py-16 text-center text-sm text-default-500">
            No titles match these filters. Try adjusting your search.
          </p>
        ) : viewer === "movie" ? (
          <AllMovieViewer allContentData={items} />
        ) : (
          <AllShowsViewer allContentData={items} />
        )}

        {totalPages > 1 && items.length > 0 ? (
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

export default function BrowseCatalogPage(props: BrowseCatalogPageProps) {
  return (
    <Suspense fallback={<PageSplash ariaLabel={`Loading ${props.pageName}`} />}>
      <BrowseCatalogPageContent {...props} />
    </Suspense>
  );
}
