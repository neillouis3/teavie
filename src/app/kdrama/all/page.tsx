import BrowseCatalogPage from '@/components/browse/BrowseCatalogPage';

export const dynamic = 'force-dynamic';

export default function AllKdramaPage() {
  return (
    <BrowseCatalogPage
      pageName="Korean Drama"
      documentTitle="Korean Drama - Teavie"
      namespace="kdrama"
      apiPath="/api/kdrama"
      genreApiPath="/api/category/kdrama/genres"
      filterMode="kdrama"
      viewer="show"
      backLink={{ href: '/kdrama', label: '← Back to Korean Drama' }}
    />
  );
}
