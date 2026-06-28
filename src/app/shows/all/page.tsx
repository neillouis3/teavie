import BrowseCatalogPage from '@/components/browse/BrowseCatalogPage';

export default function AllShowsPage() {
  return (
    <BrowseCatalogPage
      pageName="All TV Shows"
      documentTitle="All TV Shows - Teavie"
      namespace="tv"
      apiPath="/api/tv"
      filterMode="tv"
      viewer="show"
    />
  );
}
