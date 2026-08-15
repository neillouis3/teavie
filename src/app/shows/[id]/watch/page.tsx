import { Suspense } from "react";
import ShowTemplate from "@/components/showTemplate";
import { ImmersiveWatchPageSkeleton } from "@/components/ui/watchPageSkeleton";

type ShowWatchPageProps = {
  params: Promise<{ id: string }>;
};

export default async function ShowWatchPage({ params }: ShowWatchPageProps) {
  const { id } = await params;

  if (!id) {
    return <div>Error: Invalid show ID</div>;
  }

  return (
    <Suspense fallback={<ImmersiveWatchPageSkeleton />}>
      <ShowTemplate id={id} viewMode="watch" />
    </Suspense>
  );
}
