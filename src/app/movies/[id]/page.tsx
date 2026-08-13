import { Suspense } from "react";
import MovieTemplate from "@/components/movieTemplate";
import CatalogDetailsSkeleton from "@/components/ui/catalogDetailsSkeleton";

type MoviePageProps = {
  params: Promise<{ id: string }>;
};

export default async function MoviePage({ params }: MoviePageProps) {
  const { id } = await params;

  if (!id) {
    return <div>Error: Invalid movie ID</div>;
  }

  return (
    <Suspense fallback={<CatalogDetailsSkeleton />}>
      <MovieTemplate id={id} viewMode="details" />
    </Suspense>
  );
}
