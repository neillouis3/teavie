"use client";

import { useEffect, useState } from "react";

/** Fetch a TMDB title logo path for details/hero panels. */
export function useTmdbTitleLogo(
  mediaType: "movie" | "tv",
  catalogId: string | number | null | undefined
): string | null {
  const id = String(catalogId ?? "").trim();
  const [logoPath, setLogoPath] = useState<string | null>(null);

  useEffect(() => {
    if (!id || !/^\d+$/.test(id)) {
      setLogoPath(null);
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/tmdb/logos", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ items: [{ id, type: mediaType }] }),
        });
        if (!res.ok || cancelled) return;
        const json = (await res.json()) as { logos?: Record<string, string> };
        const path = json.logos?.[`${mediaType}:${id}`] ?? null;
        if (!cancelled) setLogoPath(path);
      } catch {
        if (!cancelled) setLogoPath(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [mediaType, id]);

  return logoPath;
}
