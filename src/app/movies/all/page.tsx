'use client';

import React, { Suspense, useState, useEffect } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import Header from '@/components/ui/header';
import AllMovieViewer from '@/components/viewer/allMoviesViewer';
import AllMoviesViewerLoading from '@/components/viewer/skeleton/allMoviesViewerLoading';
import BrowseCatalogFilters from '@/components/browse/BrowseCatalogFilters';
import { Pagination, Card, CardBody } from '@heroui/react';
import { ContentItem } from '@/types/content';

function AllMoviePageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const rawPage = parseInt(searchParams.get('page') || '1', 10);
  const pageParam =
    Number.isFinite(rawPage) && rawPage >= 1 ? rawPage : 1;
  const sortParam = searchParams.get('sort_by') || 'title';
  const genreParam = searchParams.get('genre') ?? '';
  const yearMinParam = searchParams.get('year_min') ?? '';
  const yearMaxParam = searchParams.get('year_max') ?? '';
  const qParam = searchParams.get('q') ?? '';

  const [movies, setMovies] = useState<ContentItem[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    document.title = 'All Movies - Teavie';
  }, []);

  useEffect(() => {
    const fetchMovies = async () => {
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

        const response = await fetch(`/api/movies?${qs.toString()}`);
        if (response.ok) {
          const data = await response.json();
          setMovies(data.results || []);
          setTotalPages(data.totalPages || 1);
          setTotal(typeof data.total === 'number' ? data.total : 0);
        }
      } catch (error) {
        console.error('Error fetching movies:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchMovies();
  }, [
    pageParam,
    sortParam,
    genreParam,
    yearMinParam,
    yearMaxParam,
    qParam,
  ]);

  const setPage = (p: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('page', String(p));
    router.push(`${pathname}?${params.toString()}`);
  };

  return (
    <div className="bg-main flex h-full min-h-screen w-full flex-col">
      <Header pageName="All Movies" />

      <div className="my-4 flex w-full flex-col px-4 pb-10">
        <BrowseCatalogFilters mode="movie" total={total} loading={loading} />

        <div className="h-fit w-full">
          {loading ? (
            <AllMoviesViewerLoading />
          ) : movies.length === 0 ? (
            <Card shadow="none" className="border border-dashed border-default-300 bg-default-100/20">
              <CardBody className="py-16 text-center">
                <p className="text-default-600">
                  No movies match these filters. Try clearing filters or broadening
                  the year range.
                </p>
              </CardBody>
            </Card>
          ) : (
            <AllMovieViewer allContentData={movies} />
          )}
        </div>

        {totalPages > 1 && !loading && movies.length > 0 && (
          <div className="mt-6 flex w-full flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Pagination
              total={totalPages}
              page={pageParam}
              onChange={setPage}
              showControls
              size="lg"
              color="success"
              variant="flat"
            />
          </div>
        )}
      </div>
    </div>
  );
}

export default function AllMoviePage() {
  return (
    <Suspense
      fallback={
        <div className="bg-main flex min-h-screen w-full flex-col">
          <Header pageName="All Movies" />
          <div className="px-4 py-6">
            <AllMoviesViewerLoading />
          </div>
        </div>
      }
    >
      <AllMoviePageContent />
    </Suspense>
  );
}
