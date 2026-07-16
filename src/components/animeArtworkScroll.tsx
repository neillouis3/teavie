"use client";

import React, { useEffect, useState } from "react";
import ExploreSectionTitle from "@/components/explore/exploreSectionTitle";
import {
  readClientDayCache,
  writeClientDayCache,
} from "@/lib/clientDayCache";

type ArtworkItem = {
  url: string;
  source: string;
  label?: string;
};

const CACHE_PREFIX = "teavie.cache.anime-artwork.v1:";

async function fetchArtwork(idMal: number): Promise<ArtworkItem[]> {
  const qs = new URLSearchParams({ idMal: String(idMal) });
  const res = await fetch(`/api/anilist/artwork?${qs.toString()}`, {
    cache: "no-store",
  });
  if (!res.ok) return [];
  const data = await res.json();
  const items = Array.isArray(data.items) ? data.items : [];
  return items.filter(
    (it: ArtworkItem) => typeof it?.url === "string" && it.url.trim().length > 0
  );
}

export default function AnimeArtworkScroll({ idMal }: { idMal: number }) {
  const [items, setItems] = useState<ArtworkItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<ArtworkItem | null>(null);

  useEffect(() => {
    let cancelled = false;
    const cacheKey = `${CACHE_PREFIX}${idMal}`;
    const cached = readClientDayCache<ArtworkItem[]>(cacheKey);

    if (cached?.length) {
      setItems(cached);
      setLoading(false);
    } else {
      setItems([]);
      setLoading(true);
    }

    void fetchArtwork(idMal)
      .then((next) => {
        if (cancelled) return;
        setItems(next);
        if (next.length > 0) writeClientDayCache(cacheKey, next);
      })
      .catch(() => {
        if (cancelled) return;
        if (!cached?.length) setItems([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [idMal]);

  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setActive(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active]);

  if (!loading && items.length === 0) return null;

  return (
    <>
      <section
        className="mt-10 flex w-full flex-col gap-3 pt-8"
        aria-label="Artwork"
      >
        <ExploreSectionTitle variant="explore">Artwork</ExploreSectionTitle>
        {items.length > 0 ? (
          <div className="max-h-[28rem] overflow-y-auto overscroll-contain pr-1 sm:max-h-[32rem]">
            <ul className="m-0 columns-3 gap-2 p-0 sm:gap-2.5 [column-fill:_balance]">
              {items.map((item, index) => (
                <li
                  key={`${item.url}-${index}`}
                  className="mb-2 break-inside-avoid sm:mb-2.5"
                >
                  <button
                    type="button"
                    onClick={() => setActive(item)}
                    className="group relative block w-full overflow-hidden rounded-lg bg-muted text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    aria-label={
                      item.label
                        ? `View artwork: ${item.label}`
                        : `View artwork ${index + 1}`
                    }
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={item.url}
                      alt={item.label || "Artwork"}
                      loading="lazy"
                      decoding="async"
                      className="h-auto w-full object-cover transition duration-200 group-hover:opacity-90"
                    />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="columns-3 gap-2 opacity-60">
            {Array.from({ length: 9 }).map((_, i) => (
              <div
                key={i}
                className="mb-2 break-inside-avoid animate-pulse rounded-lg bg-muted"
                style={{ height: `${7 + (i % 3) * 2.5}rem` }}
              />
            ))}
          </div>
        )}
      </section>

      {active ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={active.label || "Artwork"}
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/80 p-4"
          onClick={() => setActive(null)}
        >
          <button
            type="button"
            className="absolute right-4 top-4 rounded-md bg-white/10 px-3 py-1.5 text-sm text-white hover:bg-white/20"
            onClick={() => setActive(null)}
          >
            Close
          </button>
          <div
            className="relative max-h-[90vh] max-w-[min(96vw,56rem)]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={active.url}
              alt={active.label || "Artwork"}
              className="max-h-[90vh] w-auto max-w-full rounded-lg object-contain"
            />
            {active.label ? (
              <p className="mt-2 text-center text-sm text-white/80">
                {active.label}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
