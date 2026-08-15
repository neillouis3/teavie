import PersonPageClient from "@/components/person/PersonPageClient";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function PersonPage({ params }: PageProps) {
  const { id } = await params;
  return (
    <div className="h-fit w-full">
      <PersonPageClient personId={id} />
    </div>
  );
}
