import Link from "next/link";
import { listCatalogCategories } from "@/lib/catalogCategories";

export function CategorySquareTile({
  category,
}: {
  category: ReturnType<typeof listCatalogCategories>[number];
}) {
  return (
    <Link
      href={category.href}
      aria-label={`Browse ${category.label}`}
      className="group relative flex aspect-square w-full overflow-hidden rounded-xl p-2.5 sm:p-3"
    >
      <span
        className={`pointer-events-none absolute inset-0 rounded-xl bg-gradient-to-br ${category.tileColor} shadow-sm`}
        aria-hidden
      />
      <div className="relative z-20 mt-auto flex flex-col">
        <span className="text-xs font-bold leading-tight text-white drop-shadow-sm sm:text-sm">
          {category.label}
        </span>
      </div>
      <span className="pointer-events-none absolute inset-0 z-[1] rounded-xl bg-gradient-to-br from-white/15 to-black/20" />
    </Link>
  );
}

export function CategorySquareTilesSkeleton({ count = 2 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="aspect-square w-full animate-pulse rounded-xl bg-default-200"
        />
      ))}
    </div>
  );
}
