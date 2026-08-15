import ExploreHub from "@/components/explore/exploreHub";
import { getCachedExplorePayload } from "@/lib/api/exploreCache";
import { exploreCoreFromApiPayload } from "@/lib/explorePageData";

export const revalidate = 3600;

export default async function ExplorePage() {
  const payload = await getCachedExplorePayload();
  const initialCore = exploreCoreFromApiPayload(payload);

  return (
    <div className="h-fit w-full">
      <ExploreHub initialCore={initialCore} />
    </div>
  );
}
