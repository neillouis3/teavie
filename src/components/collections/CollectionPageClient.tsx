"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import CollectionTitlesGrid from "@/components/collections/CollectionTitlesGrid";
import PageBlurredBackdrop from "@/components/ui/pageBlurredBackdrop";
import { readClientDayCache, writeClientDayCache } from "@/lib/clientDayCache";
import { tmdbImageUrl } from "@/lib/tmdbImage";
import {
  PAGE_BODY,
  PAGE_CONTENT_OUTER,
  PAGE_SHELL_MIN,
  PAGE_TITLE,
} from "@/lib/pageLayout";
import type { ContentItem } from "@/types/content";

type CollectionPageProps = {
  collectionId: string;
};

type CollectionPayload = {
  collection: {
    id: number;
    name: string;
    poster_path?: string | null;
    backdrop_path?: string | null;
    overview?: string;
  } | null;
  items: ContentItem[];
};

const COLLECTION_PAGE_CACHE_PREFIX = "teavie.cache.collection-page.v1:";

function collectionBackdropUrl(collection: CollectionPayload["collection"]) {
  if (!collection) return null;
  return (
    tmdbImageUrl(collection.backdrop_path) ||
    tmdbImageUrl(collection.poster_path) ||
    null
  );
}

export default function CollectionPageClient({ collectionId }: CollectionPageProps) {
  const cacheKey = `${COLLECTION_PAGE_CACHE_PREFIX}${collectionId}`;

  const [payload, setPayload] = useState<CollectionPayload | null>(() => {
    if (typeof window === "undefined") return null;
    return readClientDayCache<CollectionPayload>(cacheKey);
  });
  const [loading, setLoading] = useState(() => {
    if (typeof window === "undefined") return true;
    return !readClientDayCache<CollectionPayload>(cacheKey);
  });
  const [error, setError] = useState(false);

  useEffect(() => {
    document.title = payload?.collection?.name
      ? `${payload.collection.name} - Teavie`
      : "Collection - Teavie";
  }, [payload?.collection?.name]);

  useEffect(() => {
    let cancelled = false;
    const cached = readClientDayCache<CollectionPayload>(cacheKey);

    if (cached) {
      setPayload(cached);
      setLoading(false);
      setError(false);
    } else {
      setPayload(null);
      setLoading(true);
      setError(false);
    }

    void fetch(
      `/api/movie/collection?collectionId=${encodeURIComponent(collectionId)}&includeCurrent=1`
    )
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("failed"))))
      .then((data: CollectionPayload) => {
        if (cancelled) return;
        setPayload(data);
        setError(false);
        if (data.collection) writeClientDayCache(cacheKey, data);
      })
      .catch(() => {
        if (cancelled) return;
        if (!cached?.collection) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [cacheKey, collectionId]);

  const collection = payload?.collection ?? null;
  const items = payload?.items ?? [];
  const backdropImageUrl = useMemo(
    () => collectionBackdropUrl(collection),
    [collection]
  );

  const title = error
    ? "Collection not found"
    : collection?.name ?? "Collection";

  if (error && !collection) {
    return (
      <div className={PAGE_SHELL_MIN}>
        <PageBlurredBackdrop emptyFallback="dark" />
        <div className={`${PAGE_CONTENT_OUTER} items-center text-center`}>
          <h1 className={PAGE_TITLE}>{title}</h1>
          <p className={`mt-2 ${PAGE_BODY}`}>This collection could not be loaded.</p>
          <Link
            href="/movies/all"
            className="mt-6 text-sm text-success hover:underline"
          >
            Browse movies
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className={PAGE_SHELL_MIN}>
      <PageBlurredBackdrop
        imageUrl={backdropImageUrl}
        emptyFallback="dark"
      />
      <div className="relative z-10">
        <CollectionTitlesGrid
          title={title}
          overview={collection?.overview}
          items={items}
          loading={loading}
          error={false}
        />
      </div>
    </div>
  );
}
