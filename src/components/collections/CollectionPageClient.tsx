"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import CatalogGrid from "@/components/browse/catalogGrid";
import CatalogGridLoading from "@/components/browse/skeleton/catalogGridLoading";
import { CONTENT_INSET_X } from "@/lib/contentInset";
import { tmdbImageUrl } from "@/lib/tmdbImage";
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

export default function CollectionPageClient({ collectionId }: CollectionPageProps) {
  const [payload, setPayload] = useState<CollectionPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    document.title = "Collection - Teavie";
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    void fetch(
      `/api/movie/collection?collectionId=${encodeURIComponent(collectionId)}&includeCurrent=1`
    )
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("failed"))))
      .then((data: CollectionPayload) => {
        if (cancelled) return;
        setPayload(data);
        if (data.collection?.name) {
          document.title = `${data.collection.name} - Teavie`;
        }
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [collectionId]);

  const collection = payload?.collection;
  const items = payload?.items ?? [];
  const backdrop = tmdbImageUrl(collection?.backdrop_path, "w1280");
  const poster = tmdbImageUrl(collection?.poster_path, "w342");

  return (
    <div className="bg-background min-h-screen w-full">
      <div className={`pb-12 ${CONTENT_INSET_X}`}>
        {loading ? (
          <div className="py-8">
            <div className="mb-6 h-10 w-64 animate-pulse rounded-lg bg-default-200 dark:bg-default-100/10" />
            <CatalogGridLoading />
          </div>
        ) : error || !collection ? (
          <div className="py-20 text-center">
            <p className="text-sm text-default-500">Collection not found.</p>
            <Link href="/movies/all" className="mt-3 inline-block text-sm text-success hover:underline">
              Browse movies
            </Link>
          </div>
        ) : (
          <>
            <header className="relative mb-8 overflow-hidden rounded-2xl bg-default-100 dark:bg-default-100/10">
              {backdrop ? (
                <div className="relative h-40 sm:h-52 md:h-64">
                  <Image
                    src={backdrop}
                    alt=""
                    fill
                    className="object-cover object-center"
                    sizes="(max-width: 768px) 100vw, 80rem"
                    priority
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-background via-background/70 to-transparent" />
                </div>
              ) : null}
              <div
                className={`flex gap-4 px-4 pb-5 ${backdrop ? "-mt-16 relative z-10" : "pt-5"}`}
              >
                {poster ? (
                  <div className="relative h-28 w-20 shrink-0 overflow-hidden rounded-xl shadow-lg sm:h-36 sm:w-24">
                    <Image
                      src={poster}
                      alt=""
                      fill
                      className="object-cover"
                      sizes="96px"
                    />
                  </div>
                ) : null}
                <div className="min-w-0 pt-2">
                  <p className="text-xs uppercase tracking-wide text-default-500">Collection</p>
                  <h1 className="text-xl font-normal tracking-tight text-foreground sm:text-2xl">
                    {collection.name}
                  </h1>
                  {collection.overview ? (
                    <p className="mt-2 line-clamp-3 max-w-3xl text-sm text-default-500">
                      {collection.overview}
                    </p>
                  ) : null}
                  <p className="mt-2 text-xs text-default-400">
                    {items.length.toLocaleString()} titles in catalog
                  </p>
                </div>
              </div>
            </header>

            {items.length === 0 ? (
              <p className="py-12 text-center text-sm text-default-500">
                No titles from this collection are in the catalog yet.
              </p>
            ) : (
              <CatalogGrid items={items} defaultType="movie" />
            )}
          </>
        )}
      </div>
    </div>
  );
}
