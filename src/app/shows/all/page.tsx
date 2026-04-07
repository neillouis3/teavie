'use client';

import React, { Suspense, useState, useEffect } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import Header from '@/components/ui/header';
import AllShowsViewer from '@/components/viewer/allShowsViewer';
import AllMoviesViewerLoading from '@/components/viewer/skeleton/allMoviesViewerLoading';
import BrowseCatalogFilters from '@/components/browse/BrowseCatalogFilters';
import { Pagination } from '@heroui/react';
import { ContentItem } from '@/types/content';

function AllShowsPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const rawPage = parseInt(searchParams.get('page') || '1', 10);
  const pageParam = Number.isFinite(rawPage) && rawPage >= 1 ? rawPage : 1;
  const sortParam = searchParams.get('sort_by') || 'title';
  const genreParam = searchParams.get('genre') ?? '';
  const yearMinParam = searchParams.get('year_min') ?? '';
  const yearMaxParam = searchParams.get('year_max') ?? '';
  const qParam = searchParams.get('q') ?? '';

  const [shows, setShows] = useState<ContentItem[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => { document.title = 'All TV Shows - Teavie'; }, []);

  useEffect(() => {
    const fetchShows = async () => {
      setLoading(true);
      try {
        const qs = new URLSearchParams();
        qs.set('page', String(pageParam));
        qs.set('limit', '18');
        qs.set('sort_by', sortParam);
        if (genreParam) qs.set('genre', genreParam);
        if (yearMinParam) qs.set('year_min', yearMinParam);
        if (yearMaxParam) qs.set('year_max', yearMaxParam);
        if (qParam.trim()) qs.set('q', qParam.trim());

        const res = await fetch(`/api/tv?${qs.toString()}`);
        if (res.ok) {
          const data = await res.json();
          setShows(data.results || []);
          setTotalPages(data.totalPages || 1);
          setTotal(typeof data.total === 'number' ? data.total : 0);
        }
      } catch (err) {
        console.error('Error fetching shows:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchShows();
  }, [pageParam, sortParam, genreParam, yearMinParam, yearMaxParam, qParam]);

  const setPage = (p: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('page', String(p));
    router.push(`${pathname}?${params.toString()}`);
  };

  return (
    <div className="bg-main min-h-screen w-full">
      <Header pageName="All TV Shows" />
      <div className="space-y-4 px-4 pb-8 pt-2">
        <BrowseCatalogFilters mode="tv" total={total} loading={loading} />

        {loading ? (
          <AllMoviesViewerLoading />
        ) : shows.length === 0 ? (
          <p className="py-16 text-center text-sm text-default-500">
            No shows match these filters. Try adjusting your search.
          </p>
        ) : (
          <AllShowsViewer allContentData={shows} />
        )}

        {totalPages > 1 && !loading && shows.length > 0 && (
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
        )}
      </div>
    </div>
  );
}

export default function AllShowsPage() {
  return (
    <Suspense
      fallback={
        <div className="bg-main min-h-screen w-full">
          <Header pageName="All TV Shows" />
          <div className="px-4 pb-8 pt-2">
            <AllMoviesViewerLoading />
          </div>
        </div>
      }
    >
      <AllShowsPageContent />
    </Suspense>
  );
}