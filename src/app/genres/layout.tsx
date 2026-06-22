import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Genres - Teavie',
  description: 'Browse movies and TV by IMDb genre.',
};

export default function GenresLayout({ children }: { children: React.ReactNode }) {
  return children;
}
