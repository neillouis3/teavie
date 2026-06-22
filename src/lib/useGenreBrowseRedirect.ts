'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { imdbGenreSlugFromBrowseParam } from '@/lib/imdbGenres.js';

type GenreBrowseType = 'movie' | 'tv' | 'anime' | 'kdrama';

/** Sends legacy `?genre=` browse URLs to `/genre/[slug]`. */
export function useGenreBrowseRedirect(type: GenreBrowseType) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const genreParam = searchParams.get('genre') ?? '';

  useEffect(() => {
    if (!genreParam) return;
    const slug = imdbGenreSlugFromBrowseParam(genreParam);
    if (!slug) return;

    const params = new URLSearchParams(searchParams.toString());
    params.delete('genre');
    if (type === 'movie') params.set('type', 'movie');
    else if (type === 'tv') params.set('type', 'tv');
    else if (type === 'anime' || type === 'kdrama') {
      router.replace(`/genre/${slug}`);
      return;
    } else params.delete('type');

    const qs = params.toString();
    router.replace(qs ? `/genre/${slug}?${qs}` : `/genre/${slug}`);
  }, [genreParam, router, searchParams, type]);
}
