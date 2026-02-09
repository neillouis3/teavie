'use client';

import React, { Suspense, useState, useEffect } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import Header from '@/components/ui/header';
import AllMovieViewer from '@/components/viewer/allMoviesViewer';
import AllMoviesViewerLoading from '@/components/viewer/skeleton/allMoviesViewerLoading';
import { Button } from '@heroui/react';
import { ContentItem } from '@/types/content';

function AllShowsPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  // ✅ derive state from searchParams
  const pageParam = parseInt(searchParams.get("page") || "1", 10);
  const sortParam = searchParams.get("sort_by") || "title";

  const [movies, setMovies] = useState<ContentItem[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  // fetch movies when URL params change
  useEffect(() => {
    const fetchMovies = async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/tv?sort_by=${sortParam}&page=${pageParam}&limit=18`);
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
      <Header pageName="All TV Shows" />

      <div className="flex-col px-4 my-4">
        {/* Sort Controls */}
        <div className="w-full flex flex-row items-center gap-4 mb-4">
          <span className="text-sm">Sort by: </span>

          <Button
            radius="full"
            size="sm"
            variant={sortParam === "title" ? "solid" : "ghost"}
            onPress={() => updateParams({ sort_by: "title", page: 1 })}
          >
            Title
          </Button>

          <Button
            radius="full"
            size="sm"
            variant={sortParam === "release_year" ? "solid" : "ghost"}
            onPress={() => updateParams({ sort_by: "release_year", page: 1 })}
          >
            Release Date
          </Button>
        </div>

        {/* Movie Viewer */}
        <div className="h-fit w-full">
          {loading ? (
            <AllMoviesViewerLoading />
          ) : (
            <AllMovieViewer allContentData={movies} />
          )}
        </div>

        {/* Pagination Controls */}
        <div className="flex items-center mt-4">
          <Button
            radius="full"
            size="md"
            variant="flat"
            onPress={() => updateParams({ page: pageParam - 1, sort_by: sortParam })}
            disabled={pageParam <= 1}
          >
            Previous
          </Button>
          <span className="text-md mx-4">{`Page ${pageParam} of ${totalPages}`}</span>
          <Button
            radius="full"
            size="md"
            variant="flat"
            onPress={() => updateParams({ page: pageParam + 1, sort_by: sortParam })}
            disabled={pageParam >= totalPages}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function AllShowsPage() {
  return (
    <Suspense fallback={<AllMoviesViewerLoading />}>
      <AllShowsPageContent />
    </Suspense>
  );
}
