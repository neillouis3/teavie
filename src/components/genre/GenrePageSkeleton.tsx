export function GridSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 lg:grid-cols-4">
      {Array.from({ length: 12 }).map((_, i) => (
        <div key={i} className="space-y-2">
          <div className="aspect-[2/3] animate-pulse rounded-xl bg-default-200" />
          <div className="h-4 w-3/4 animate-pulse rounded bg-default-200" />
          <div className="h-3 w-1/2 animate-pulse rounded bg-default-200" />
        </div>
      ))}
    </div>
  );
}
