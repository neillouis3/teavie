'use client';

import React, { Suspense, useState, useEffect } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import Header from '@/components/ui/header';
import AllMovieViewer from '@/components/viewer/allMoviesViewer';
import AllMoviesViewerLoading from '@/components/viewer/skeleton/allMoviesViewerLoading';
import { Button, Pagination } from '@heroui/react';
import { ContentItem } from '@/types/content';

function AllMoviePageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  // ✅ derive state from searchParams
  const pageParam = parseInt(searchParams.get("page") || "1", 10);
  const sortParam = searchParams.get("sort_by") || "title";

  const [movies, setMovies] = useState<ContentItem[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  // Update page title
  useEffect(() => {
    document.title = "All Movies - Teavie";
  }, []);

  // fetch movies when URL params change
  useEffect(() => {
    const fetchMovies = async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/movies?sort_by=${sortParam}&page=${pageParam}&limit=18`);
        if (response.ok) {
          const data = await response.json();
          setMovies(data.results || []);
          setTotalPages(data.totalPages || 1);
        }
      } catch (error) {
        console.error("Error fetching movies:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchMovies();
  }, [pageParam, sortParam]);

  // helper to update the URL
  const updateParams = (newParams: Record<string, string | number>) => {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(newParams).forEach(([key, value]) => {
      params.set(key, String(value));
    });
    router.push(`${pathname}?${params.toString()}`);
  };

  return (
    <div className="bg-main h-full w-full flex flex-col">
      <Header pageName="All Movies" />

      <div className="flex-col px-4 my-4">
        {/* Sort Controls */}
        <div className="w-full flex flex-col gap-2 mb-4 sm:flex-row sm:items-center sm:justify-between">
          
          <div className="flex flex-wrap gap-2">
            {[
              { value: "title", label: "Title (A–Z)" },
              { value: "release_year", label: "Release date" },
              { value: "popularity", label: "Trending" },
            ].map((opt) => {
              const isActive = sortParam === opt.value;
              return (
                <Button
                  key={opt.value}
                  radius="full"
                  size="md"
                  variant={isActive ? "solid" : "flat"}
                  color={isActive ? "primary" : "default"}
                  onPress={() => updateParams({ sort_by: opt.value, page: 1 })}
                >
                  {opt.label}
                </Button>
              );
            })}
          </div>
        </div>

        {/* Movie Viewer */}
        <div className="h-fit w-full">
          {loading ? (
            <AllMoviesViewerLoading />
          ) : (
            <AllMovieViewer allContentData={movies} />
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="w-full flex flex-col gap-2 mt-2 mb-4 sm:flex-row sm:items-center sm:justify-between">

            <Pagination
              total={totalPages}
              page={pageParam}
              onChange={(p) => updateParams({ page: p, sort_by: sortParam })}
              showControls
              size="lg"
              
              color="primary"
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
    <Suspense fallback={<AllMoviesViewerLoading />}>
      <AllMoviePageContent />
    </Suspense>
  );
}
