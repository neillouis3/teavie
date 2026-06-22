import type { Metadata } from 'next';
import { imdbGenreLabelFromSlug, isValidImdbGenreSlug } from '@/lib/imdbGenres';

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const label = imdbGenreLabelFromSlug(slug);
  if (!label || !isValidImdbGenreSlug(slug)) {
    return { title: 'Genre - Teavie' };
  }
  return {
    title: `${label} - Teavie`,
    description: `Browse ${label} movies, TV shows, anime, and K-Dramas.`,
  };
}

export default function GenreSlugLayout({ children }: { children: React.ReactNode }) {
  return children;
}
