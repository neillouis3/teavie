import { Suspense } from "react";
import MovieTemplate from "@/components/movieTemplate";
import { ImmersiveWatchPageSkeleton } from "@/components/ui/watchPageSkeleton";

type MovieWatchPageProps = {
  params: Promise<{ id: string }>;
};

export default async function MovieWatchPage({ params }: MovieWatchPageProps) {
  const { id } = await params;

  if (!id) {
    return <div>Error: Invalid movie ID</div>;
  }

  return (
    <Suspense fallback={<ImmersiveWatchPageSkeleton />}>
      <MovieTemplate id={id} viewMode="watch" />
    </Suspense>
  );
}
