import type { MutableRefObject } from "react";
import { catalogHeroImageUrl } from "@/lib/tmdbImage";
import {
  seedBannerPath,
  type CatalogDetailsSeed,
} from "@/lib/catalogDetailsSeed";
import { getPreloadedHeroBanner } from "@/lib/catalogDetailsPrefetch";

/** Freeze modal hero art on first paint — never swap after open. */
export function resolveFrozenModalHeroBanner(
  frozenRef: MutableRefObject<string | null>,
  opts: {
    mediaType: "movie" | "show";
    catalogId: string;
    seed: CatalogDetailsSeed | null | undefined;
    resolveFromDoc: () => string | null;
  }
): string | null {
  if (frozenRef.current) return frozenRef.current;

  const preloaded = getPreloadedHeroBanner(opts.mediaType, opts.catalogId);
  if (preloaded) {
    frozenRef.current = preloaded;
    return preloaded;
  }

  const seedUrl = catalogHeroImageUrl(seedBannerPath(opts.seed) ?? "");
  if (seedUrl) {
    frozenRef.current = seedUrl;
    return seedUrl;
  }

  const resolved = opts.resolveFromDoc();
  frozenRef.current = resolved;
  return resolved;
}
