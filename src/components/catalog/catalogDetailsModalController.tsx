"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import CatalogDetailsSkeleton from "@/components/ui/catalogDetailsSkeleton";
import ResponsiveDetailsOverlay from "@/components/catalog/responsiveDetailsOverlay";
import MovieTemplate from "@/components/movieTemplate";
import ShowTemplate from "@/components/showTemplate";
import {
  installCatalogDetailsPrefetchListeners,
  prefetchCatalogDetailsPath,
  preloadHeroBannerFromSeed,
} from "@/lib/catalogDetailsPrefetch";
import {
  CATALOG_SEED_ATTR,
  parseCatalogSeed,
  type CatalogDetailsSeed,
} from "@/lib/catalogDetailsSeed";

type DetailsTarget = {
  type: "movie" | "show";
  id: string;
  seed: CatalogDetailsSeed | null;
};

function targetFromPath(pathname: string): DetailsTarget | null {
  const match = /^\/(movies|shows)\/([^/]+)\/?$/.exec(pathname);
  if (!match) return null;
  if (["all", "admin"].includes(match[2].toLowerCase())) return null;
  return {
    type: match[1] === "movies" ? "movie" : "show",
    id: decodeURIComponent(match[2]),
    seed: null,
  };
}

export default function CatalogDetailsModalController() {
  const [target, setTarget] = useState<DetailsTarget | null>(null);

  useEffect(() => installCatalogDetailsPrefetchListeners(), []);

  useEffect(() => {
    const onDocumentClick = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey ||
        window.innerWidth < 1024
      ) {
        return;
      }

      const element = event.target instanceof Element ? event.target : null;
      if (element?.closest("[data-no-details-modal]")) {
        return;
      }

      const anchor = element?.closest<HTMLAnchorElement>("a[href]");
      if (anchor && anchor.target !== "_blank" && !anchor.hasAttribute("download")) {
        const url = new URL(anchor.href, window.location.href);
        if (url.origin === window.location.origin) {
          const next = targetFromPath(url.pathname);
          if (next) {
            event.preventDefault();
            const seed = parseCatalogSeed(anchor.getAttribute(CATALOG_SEED_ATTR));
            preloadHeroBannerFromSeed(seed);
            prefetchCatalogDetailsPath(url.pathname, { full: true });
            setTarget({ ...next, seed });
            return;
          }
        }
      }

      if (
        element?.closest(
          "button, input, select, textarea, label, [role='button']"
        )
      ) {
        return;
      }

      if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download")) {
        return;
      }

      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      setTarget(null);
    };

    document.addEventListener("click", onDocumentClick, true);
    return () => {
      document.removeEventListener("click", onDocumentClick, true);
    };
  }, []);

  const close = useCallback(() => {
    setTarget(null);
  }, []);

  if (!target) return null;

  return (
    <ResponsiveDetailsOverlay
      label={target.type === "movie" ? "Movie details" : "Show details"}
      onClose={close}
    >
      <Suspense fallback={<CatalogDetailsSkeleton modal />}>
        {target.type === "movie" ? (
          <MovieTemplate
            id={target.id}
            viewMode="details"
            detailsModal
            detailsSeed={target.seed}
            onDetailsNavigate={close}
          />
        ) : (
          <ShowTemplate
            id={target.id}
            viewMode="details"
            detailsModal
            detailsSeed={target.seed}
            onDetailsNavigate={close}
          />
        )}
      </Suspense>
    </ResponsiveDetailsOverlay>
  );
}
