import SmallCardLoading from '@/components/ui/smallCardLoading';
import { CATALOG_GRID_VERTICAL_SEARCH } from '@/lib/catalogGrid';

export function GridSkeleton() {
  return (
    <div className={CATALOG_GRID_VERTICAL_SEARCH}>
      {Array.from({ length: 14 }).map((_, i) => (
        <SmallCardLoading key={i} />
      ))}
    </div>
  );
}
