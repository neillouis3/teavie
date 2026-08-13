/**
 * Client-side prefetch + cache for catalog details modal (resolve → details).
 */

import { tmdbImageUrl } from "@/lib/tmdbImage";

type CacheEntry<T> = { data: T; at: number };

const TTL_MS = 10 * 60 * 1000;

const movieResolveCache = new Map<string, CacheEntry<unknown>>();
const movieDetailsCache = new Map<string, CacheEntry<unknown>>();
const tvResolveCache = new Map<string, CacheEntry<unknown>>();
const tvDetailsCache = new Map<string, CacheEntry<unknown>>();

const inflight = new Map<string, Promise<unknown>>();

function readCache<T>(map: Map<string, CacheEntry<T>>, key: string): T | null {
  const hit = map.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > TTL_MS) {
    map.delete(key);
    return null;
  }
  return hit.data;
}

function writeCache<T>(map: Map<string, CacheEntry<T>>, key: string, data: T) {
  map.set(key, { data, at: Date.now() });
}

async function dedupeFetch<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  const existing = inflight.get(key);
  if (existing) return existing as Promise<T>;
  const promise = fetcher().finally(() => {
    inflight.delete(key);
  });
  inflight.set(key, promise);
  return promise;
}

function preloadBannerFromDoc(doc: {
  backdrop_path?: string | null;
  poster_path?: string | null;
  anilist?: {
    bannerImage?: string | null;
    coverImage?: { extraLarge?: string | null; large?: string | null };
  };
}) {
  if (typeof window === "undefined") return;
  const candidates = [
    doc.anilist?.bannerImage,
    doc.backdrop_path,
    doc.anilist?.coverImage?.extraLarge,
    doc.anilist?.coverImage?.large,
    doc.poster_path,
  ];
  for (const value of candidates) {
    const raw = typeof value === "string" ? value.trim() : "";
    if (!raw) continue;
    const url = tmdbImageUrl(raw) || raw;
    if (url) {
      const img = new Image();
      img.src = url;
      return;
    }
  }
}

export async function fetchMovieResolveCached(id: string): Promise<unknown> {
  const key = String(id);
  const cached = readCache(movieResolveCache, key);
  if (cached) return cached;
  return dedupeFetch(`movie-resolve:${key}`, async () => {
    const res = await fetch(`/api/movie/resolve?id=${encodeURIComponent(key)}`);
    const data = await res.json().catch(() => null);
    if (data) writeCache(movieResolveCache, key, data);
    return data;
  });
}

export async function fetchMovieDetailsCached(
  tmdbId: string,
  opts?: { lite?: boolean }
): Promise<unknown> {
  const lite = opts?.lite === true;
  const key = lite ? `lite:${tmdbId}` : String(tmdbId);
  const cached = readCache(movieDetailsCache, key);
  if (cached) return cached;
  return dedupeFetch(`movie-details:${key}`, async () => {
    const qs = new URLSearchParams({ id: String(tmdbId) });
    if (lite) qs.set("lite", "1");
    const res = await fetch(`/api/movie/details?${qs.toString()}`);
    const data = await res.json().catch(() => null);
    if (res.ok && data) writeCache(movieDetailsCache, key, data);
    return res.ok ? data : null;
  });
}

export async function fetchTvResolveCached(
  id: string,
  adminKey?: string
): Promise<unknown> {
  const key = adminKey ? `${id}:${adminKey}` : String(id);
  const cached = readCache(tvResolveCache, key);
  if (cached) return cached;
  return dedupeFetch(`tv-resolve:${key}`, async () => {
    const qs = new URLSearchParams({ id: String(id) });
    if (adminKey?.trim()) qs.set("adminKey", adminKey.trim());
    const res = await fetch(`/api/tv/resolve?${qs.toString()}`);
    const data = await res.json().catch(() => null);
    if (data) writeCache(tvResolveCache, key, data);
    return data;
  });
}

export async function fetchTvDetailsCached(
  tmdbId: string,
  opts?: { lite?: boolean }
): Promise<unknown> {
  const lite = opts?.lite === true;
  const key = lite ? `lite:${tmdbId}` : String(tmdbId);
  const cached = readCache(tvDetailsCache, key);
  if (cached) return cached;
  return dedupeFetch(`tv-details:${key}`, async () => {
    const qs = new URLSearchParams({ id: String(tmdbId) });
    if (lite) qs.set("lite", "1");
    const res = await fetch(`/api/tv/details?${qs.toString()}`);
    const data = await res.json().catch(() => null);
    if (res.ok && data) writeCache(tvDetailsCache, key, data);
    return res.ok ? data : null;
  });
}

export async function prefetchMovieDetails(id: string): Promise<void> {
  try {
    const resolved = (await fetchMovieResolveCached(id)) as {
      playerId?: number | string | null;
      fallback?: {
        backdrop_path?: string | null;
        poster_path?: string | null;
      } | null;
    } | null;
    if (!resolved) return;
    const tmdbId =
      resolved.playerId != null ? String(resolved.playerId) : String(id);
    if (/^\d+$/.test(tmdbId)) {
      const details = await fetchMovieDetailsCached(tmdbId, { lite: true });
      if (details && typeof details === "object") {
        preloadBannerFromDoc(details as { backdrop_path?: string | null; poster_path?: string | null });
      } else if (resolved.fallback) {
        preloadBannerFromDoc(resolved.fallback);
      }
      return;
    }
    if (resolved.fallback) {
      preloadBannerFromDoc(resolved.fallback);
    }
  } catch {
    /* best-effort */
  }
}

export async function prefetchShowDetails(id: string): Promise<void> {
  try {
    const resolved = (await fetchTvResolveCached(id)) as {
      playerId?: number | string | null;
      fallback?: {
        backdrop_path?: string | null;
        poster_path?: string | null;
        anilist?: {
          bannerImage?: string | null;
          coverImage?: { extraLarge?: string | null; large?: string | null };
        };
      } | null;
    } | null;
    if (!resolved) return;
    const tmdbId =
      resolved.playerId != null ? String(resolved.playerId) : String(id);
    if (/^\d+$/.test(tmdbId) && !/^anime_/i.test(String(id).trim())) {
      const details = await fetchTvDetailsCached(tmdbId, { lite: true });
      if (details && typeof details === "object") {
        preloadBannerFromDoc(
          details as { backdrop_path?: string | null; poster_path?: string | null }
        );
      } else if (resolved.fallback) {
        preloadBannerFromDoc(resolved.fallback);
      }
      return;
    }
    if (resolved.fallback) {
      preloadBannerFromDoc(resolved.fallback);
    }
  } catch {
    /* best-effort */
  }
}

export function prefetchCatalogDetailsPath(
  pathname: string,
  opts?: { full?: boolean }
): void {
  if (typeof window === "undefined") return;
  const movie = /^\/movies\/([^/]+)\/?$/.exec(pathname);
  if (movie && !["all", "admin"].includes(movie[1].toLowerCase())) {
    const catalogId = decodeURIComponent(movie[1]);
    if (opts?.full) {
      void prefetchMovieDetailsFull(catalogId);
    } else {
      void prefetchMovieDetails(catalogId);
    }
    return;
  }
  const show = /^\/shows\/([^/]+)\/?$/.exec(pathname);
  if (show && !["all", "admin"].includes(show[1].toLowerCase())) {
    const catalogId = decodeURIComponent(show[1]);
    if (opts?.full) {
      void prefetchShowDetailsFull(catalogId);
    } else {
      void prefetchShowDetails(catalogId);
    }
  }
}

async function prefetchMovieDetailsFull(id: string): Promise<void> {
  try {
    const resolved = (await fetchMovieResolveCached(id)) as {
      playerId?: number | string | null;
    } | null;
    if (!resolved) return;
    const tmdbId =
      resolved.playerId != null ? String(resolved.playerId) : String(id);
    if (/^\d+$/.test(tmdbId)) {
      await fetchMovieDetailsCached(tmdbId, { lite: true });
      void fetchMovieDetailsCached(tmdbId);
    }
  } catch {
    /* best-effort */
  }
}

async function prefetchShowDetailsFull(id: string): Promise<void> {
  try {
    const resolved = (await fetchTvResolveCached(id)) as {
      playerId?: number | string | null;
    } | null;
    if (!resolved) return;
    const tmdbId =
      resolved.playerId != null ? String(resolved.playerId) : String(id);
    if (/^\d+$/.test(tmdbId) && !/^anime_/i.test(String(id).trim())) {
      await fetchTvDetailsCached(tmdbId, { lite: true });
      void fetchTvDetailsCached(tmdbId);
    }
  } catch {
    /* best-effort */
  }
}

export function installCatalogDetailsPrefetchListeners(): () => void {
  if (typeof window === "undefined") return () => {};

  const onPointerOver = (event: Event) => {
    if (window.innerWidth < 1024) return;
    const target = event.target;
    if (!(target instanceof Element)) return;
    const anchor = target.closest<HTMLAnchorElement>("a[href]");
    if (!anchor || anchor.target === "_blank") return;
    try {
      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      prefetchCatalogDetailsPath(url.pathname);
    } catch {
      /* ignore bad href */
    }
  };

  document.addEventListener("pointerover", onPointerOver, true);
  return () => document.removeEventListener("pointerover", onPointerOver, true);
}
