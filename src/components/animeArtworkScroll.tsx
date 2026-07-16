"use client";

import React, { useEffect, useRef, useState } from "react";
import ExploreSectionTitle from "@/components/explore/exploreSectionTitle";
import {
  readClientDayCache,
  writeClientDayCache,
} from "@/lib/clientDayCache";
import { cn } from "@/lib/utils";

type ArtworkItem = {
  url: string;
  source: string;
  label?: string;
};

const CACHE_PREFIX = "teavie.cache.anime-artwork.v2:";
/** First paint: ~4 rows × 3 columns. */
const INITIAL_VISIBLE = 12;
/** Extra images revealed each time the bottom sentinel enters view. */
const PAGE_SIZE = 9;

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

function ArtworkTile({
  item,
  index,
  onOpen,
}: {
  item: ArtworkItem;
  index: number;
  onOpen: () => void;
}) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const imgRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    setLoaded(false);
    setFailed(false);
  }, [item.url]);

  useEffect(() => {
    const img = imgRef.current;
    if (img?.complete && img.naturalWidth > 0) setLoaded(true);
  }, [item.url]);

  if (failed) return null;

  return (
    <li className="mb-2 break-inside-avoid sm:mb-2.5">
      <button
        type="button"
        onClick={onOpen}
        disabled={!loaded}
        className="group relative block w-full overflow-hidden rounded-lg bg-muted text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-default"
        aria-label={
          item.label
            ? `View artwork: ${item.label}`
            : `View artwork ${index + 1}`
        }
      >
        {!loaded ? (
          <div
            className="w-full animate-pulse bg-default-200/70 dark:bg-white/10"
            style={{
              aspectRatio:
                index % 3 === 0 ? "2 / 3" : index % 3 === 1 ? "3 / 4" : "1 / 1",
            }}
            aria-hidden
          />
        ) : null}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          ref={imgRef}
          src={item.url}
          alt={item.label || "Artwork"}
          loading="lazy"
          decoding="async"
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
          className={cn(
            "h-auto w-full object-cover transition duration-300 group-hover:opacity-90",
            loaded ? "relative opacity-100" : "absolute inset-0 h-full w-full opacity-0"
          )}
        />
      </button>
    </li>
  );
}

export default function AnimeArtworkScroll({ idMal }: { idMal: number }) {
  const [items, setItems] = useState<ArtworkItem[]>([]);
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<ArtworkItem | null>(null);
  const [lightboxLoaded, setLightboxLoaded] = useState(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    const cacheKey = `${CACHE_PREFIX}${idMal}`;
    const cached = readClientDayCache<ArtworkItem[]>(cacheKey);

    setVisibleCount(INITIAL_VISIBLE);

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
        setVisibleCount(INITIAL_VISIBLE);
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
    setLightboxLoaded(false);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setActive(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active]);

  const hasMore = visibleCount < items.length;

  useEffect(() => {
    if (!hasMore) return;
    const node = sentinelRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        setVisibleCount((n) => Math.min(n + PAGE_SIZE, items.length));
      },
      { root: null, rootMargin: "240px 0px", threshold: 0 }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, items.length, visibleCount]);

  if (!loading && items.length === 0) return null;

  const visible = items.slice(0, visibleCount);

  return (
    <>
      <section
        className="mt-10 flex w-full flex-col gap-3 pt-8"
        aria-label="Artwork"
      >
        <ExploreSectionTitle variant="explore">Artwork</ExploreSectionTitle>
        {items.length > 0 ? (
          <>
            <ul className="m-0 columns-3 gap-2 p-0 sm:gap-2.5">
              {visible.map((item, index) => (
                <ArtworkTile
                  key={`${item.url}-${index}`}
                  item={item}
                  index={index}
                  onOpen={() => setActive(item)}
                />
              ))}
            </ul>
            {hasMore ? (
              <div ref={sentinelRef} className="h-8 w-full" aria-hidden />
            ) : null}
          </>
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
            className="relative flex min-h-[12rem] min-w-[12rem] max-h-[90vh] max-w-[min(96vw,56rem)] items-center justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            {!lightboxLoaded ? (
              <div
                className="absolute inset-8 animate-pulse rounded-lg bg-white/10"
                aria-hidden
              />
            ) : null}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={active.url}
              alt={active.label || "Artwork"}
              onLoad={() => setLightboxLoaded(true)}
              className={cn(
                "max-h-[90vh] w-auto max-w-full rounded-lg object-contain transition-opacity duration-300",
                lightboxLoaded ? "opacity-100" : "opacity-0"
              )}
            />
            {active.label && lightboxLoaded ? (
              <p className="absolute -bottom-8 left-0 right-0 text-center text-sm text-white/80">
                {active.label}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
