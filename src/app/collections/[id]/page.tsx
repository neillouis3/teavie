import CollectionPageClient from "@/components/collections/CollectionPageClient";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function CollectionPage({ params }: PageProps) {
  const { id } = await params;
  return (
    <div className="h-fit w-full">
      <CollectionPageClient collectionId={id} />
    </div>
  );
}
