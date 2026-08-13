import { Suspense } from "react";
import ShowTemplate from "@/components/showTemplate";
import CatalogDetailsSkeleton from "@/components/ui/catalogDetailsSkeleton";

type ShowPageProps = {
  params: Promise<{ id: string }>;
};

export default async function ShowPage({ params }: ShowPageProps) {
  const { id } = await params;

  if (!id) {
    return <div>Error: Invalid show ID</div>;
  }

  return (
    <Suspense fallback={<CatalogDetailsSkeleton />}>
      <ShowTemplate id={id} viewMode="details" />
    </Suspense>
  );
}
