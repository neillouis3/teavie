import BrowseCatalogPage from '@/components/browse/BrowseCatalogPage';

export const dynamic = 'force-dynamic';

export default function AllMoviePage() {
  return (
    <BrowseCatalogPage
      pageName="All Movies"
      documentTitle="All Movies - Teavie"
      namespace="movies"
      apiPath="/api/movies"
      filterMode="movie"
      viewer="movie"
    />
  );
}
