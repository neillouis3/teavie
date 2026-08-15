import { Suspense } from "react";
import ShowTemplate from "@/components/showTemplate";
import ShowEpisodesPageSkeleton from "@/components/show/ShowEpisodesPageSkeleton";

type ShowEpisodesPageProps = {
  params: Promise<{ id: string }>;
};

export default async function ShowEpisodesPage({ params }: ShowEpisodesPageProps) {
  const { id } = await params;

  if (!id) {
    return <div>Error: Invalid show ID</div>;
  }

  return (
    <Suspense fallback={<ShowEpisodesPageSkeleton />}>
      <ShowTemplate id={id} viewMode="episodes" />
    </Suspense>
  );
}
