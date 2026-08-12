import BrowseCatalogPage from '@/components/browse/BrowseCatalogPage';

export const dynamic = 'force-dynamic';

export default function AllShowsPage() {
  return (
    <BrowseCatalogPage
      pageName="All Shows"
      documentTitle="All TV Shows - Teavie"
      namespace="tv"
      apiPath="/api/tv"
      filterMode="tv"
      viewer="show"
    />
  );
}
