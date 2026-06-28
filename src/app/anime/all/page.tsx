import BrowseCatalogPage from '@/components/browse/BrowseCatalogPage';

export default function AllAnimePage() {
  return (
    <BrowseCatalogPage
      pageName="All Anime"
      documentTitle="All Anime - Teavie"
      namespace="anime"
      apiPath="/api/anime"
      genreApiPath="/api/category/anime/genres"
      filterMode="anime"
      viewer="show"
    />
  );
}
