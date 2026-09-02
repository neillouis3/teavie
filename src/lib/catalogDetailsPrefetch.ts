/**
 * Client-side prefetch + cache for catalog details modal (resolve → details).
 */

import { tmdbImageUrl, catalogHeroImageUrl } from "@/lib/tmdbImage";
import {
  animeHeroBannerFromDoc,
  isAnimePortraitCoverUrl,
} from "@/lib/animePoster.js";
import {
  parseCatalogSeed,
  seedBannerPath,
  CATALOG_SEED_ATTR,
  type CatalogDetailsSeed,
} from "@/lib/catalogDetailsSeed";

type CacheEntry<T> = { data: T; at: number };

const TTL_MS = 10 * 60 * 1000;

const movieResolveCache = new Map<string, CacheEntry<unknown>>();
const movieDetailsCache = new Map<string, CacheEntry<unknown>>();
const tvResolveCache = new Map<string, CacheEntry<unknown>>();
const tvDetailsCache = new Map<string, CacheEntry<unknown>>();
const heroBannerReadyCache = new Map<string, CacheEntry<string>>();

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

function preloadImage(url: string): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false);
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(true);
    img.onerror = () => resolve(false);
    img.src = url;
  });
}

function heroBannerCacheKey(mediaType: "movie" | "show", catalogId: string): string {
  return `${mediaType}:${String(catalogId).trim()}`;
}

function readReadyHeroBanner(key: string): string | null {
  const hit = heroBannerReadyCache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > TTL_MS) {
    heroBannerReadyCache.delete(key);
    return null;
  }
  return hit.data;
}

function writeReadyHeroBanner(key: string, url: string) {
  heroBannerReadyCache.set(key, { data: url, at: Date.now() });
}

function pickHeroBannerUrl(
  candidates: Array<string | null | undefined>
): string | null {
  const widescreen: string[] = [];
  const fallback: string[] = [];

  for (const value of candidates) {
    const raw = typeof value === "string" ? value.trim() : "";
    if (!raw) continue;
    const url = catalogHeroImageUrl(raw) || raw;
    if (!url) continue;
    if (isAnimePortraitCoverUrl(url)) fallback.push(url);
    else widescreen.push(url);
  }

  return widescreen[0] ?? fallback[0] ?? null;
}

async function fetchAnilistHeroUrl(malId: number): Promise<string | null> {
  try {
    const res = await fetch(`/api/anilist/media?idMal=${malId}`);
    if (!res.ok) return null;
    const data = (await res.json()) as {
      bannerImage?: string | null;
      coverImage?: { extraLarge?: string | null; large?: string | null } | null;
    };
    return pickHeroBannerUrl([
      data?.bannerImage,
      data?.coverImage?.extraLarge,
      data?.coverImage?.large,
    ]);
  } catch {
    return null;
  }
}

function malIdFromCatalogId(
  catalogId: string,
  fallback?: {
    mal_id?: number | null;
    external_ids?: { mal_id?: number | null } | null;
  } | null
): number | null {
  const match = /^anime_(\d+)$/i.exec(String(catalogId).trim());
  if (match) {
    const n = parseInt(match[1], 10);
    return Number.isFinite(n) && n > 0 ? n : null;
  }
  if (typeof fallback?.mal_id === "number" && fallback.mal_id > 0) {
    return fallback.mal_id;
  }
  const ext = fallback?.external_ids?.mal_id;
  if (typeof ext === "number" && ext > 0) return ext;
  return null;
}

/** Card seed image — usually already in browser cache from the rail tile. */
export function preloadHeroBannerFromSeed(
  seed: CatalogDetailsSeed | null | undefined
): void {
  const url = catalogHeroImageUrl(seedBannerPath(seed) ?? "");
  if (url) void preloadImage(url);
}

export function getPreloadedHeroBanner(
  mediaType: "movie" | "show",
  catalogId: string
): string | null {
  return readReadyHeroBanner(heroBannerCacheKey(mediaType, catalogId));
}

async function cacheReadyHeroBanner(
  mediaType: "movie" | "show",
  catalogId: string,
  url: string | null
): Promise<void> {
  if (!url) return;
  if (await preloadImage(url)) {
    writeReadyHeroBanner(heroBannerCacheKey(mediaType, catalogId), url);
  }
}

async function prefetchShowHeroBanner(catalogId: string): Promise<void> {
  const key = heroBannerCacheKey("show", catalogId);
  if (readReadyHeroBanner(key)) return;

  const resolved = (await fetchTvResolveCached(catalogId)) as {
    playerId?: number | string | null;
    fallback?: Record<string, unknown> | null;
  } | null;

  const fallback =
    resolved?.fallback && typeof resolved.fallback === "object"
      ? resolved.fallback
      : null;

  const malId = malIdFromCatalogId(catalogId, fallback as {
    mal_id?: number | null;
    external_ids?: { mal_id?: number | null } | null;
  });

  const anilistHero =
    malId != null ? await fetchAnilistHeroUrl(malId) : null;

  const tmdbId =
    resolved?.playerId != null ? String(resolved.playerId) : String(catalogId);

  let tmdbBackdrop: string | null = null;
  if (/^\d+$/.test(tmdbId) && !/^anime_/i.test(String(catalogId).trim())) {
    const details = (await fetchTvDetailsCached(tmdbId, { lite: true })) as {
      backdrop_path?: string | null;
    } | null;
    tmdbBackdrop = details?.backdrop_path ?? null;
  }

  const url = pickHeroBannerUrl([
    anilistHero,
    (fallback?.anilist as { bannerImage?: string | null } | undefined)?.bannerImage,
    animeHeroBannerFromDoc(fallback),
    tmdbBackdrop,
    fallback?.backdrop_path as string | null | undefined,
  ]);

  await cacheReadyHeroBanner("show", catalogId, url);
}

async function prefetchMovieHeroBanner(catalogId: string): Promise<void> {
  const key = heroBannerCacheKey("movie", catalogId);
  if (readReadyHeroBanner(key)) return;

  const resolved = (await fetchMovieResolveCached(catalogId)) as {
    playerId?: number | string | null;
    fallback?: { backdrop_path?: string | null; poster_path?: string | null } | null;
  } | null;

  const tmdbId =
    resolved?.playerId != null ? String(resolved.playerId) : String(catalogId);

  let tmdbBackdrop: string | null = null;
  if (/^\d+$/.test(tmdbId)) {
    const details = (await fetchMovieDetailsCached(tmdbId, { lite: true })) as {
      backdrop_path?: string | null;
      poster_path?: string | null;
    } | null;
    tmdbBackdrop = details?.backdrop_path ?? details?.poster_path ?? null;
  }

  const url = pickHeroBannerUrl([
    tmdbBackdrop,
    resolved?.fallback?.backdrop_path,
    resolved?.fallback?.poster_path,
  ]);

  await cacheReadyHeroBanner("movie", catalogId, url);
}

export function prefetchHeroBannerForPath(pathname: string): void {
  if (typeof window === "undefined") return;

  const movie = /^\/movies\/([^/]+)\/?$/.exec(pathname);
  if (movie && !["all", "admin"].includes(movie[1].toLowerCase())) {
    void dedupeFetch(`hero-banner:movie:${movie[1]}`, () =>
      prefetchMovieHeroBanner(decodeURIComponent(movie[1]))
    );
    return;
  }

  const show = /^\/shows\/([^/]+)\/?$/.exec(pathname);
  if (show && !["all", "admin"].includes(show[1].toLowerCase())) {
    void dedupeFetch(`hero-banner:show:${show[1]}`, () =>
      prefetchShowHeroBanner(decodeURIComponent(show[1]))
    );
  }
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
    const url = catalogHeroImageUrl(raw) || tmdbImageUrl(raw) || raw;
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
  prefetchHeroBannerForPath(pathname);

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

  let hoverTimer: ReturnType<typeof setTimeout> | null = null;
  let lastPrefetchPath = "";

  const onPointerOver = (event: Event) => {
    if (window.innerWidth < 1024) return;
    const target = event.target;
    if (!(target instanceof Element)) return;
    const anchor = target.closest<HTMLAnchorElement>("a[href]");
    if (!anchor || anchor.target === "_blank") return;
    try {
      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (url.pathname === lastPrefetchPath) return;

      if (hoverTimer) clearTimeout(hoverTimer);
      hoverTimer = setTimeout(() => {
        hoverTimer = null;
        lastPrefetchPath = url.pathname;
        const seed = parseCatalogSeed(anchor.getAttribute(CATALOG_SEED_ATTR));
        preloadHeroBannerFromSeed(seed);
        // Hover only warms resolve + lite details; the click handler fetches full.
        prefetchCatalogDetailsPath(url.pathname);
      }, 280);
    } catch {
      /* ignore bad href */
    }
  };

  document.addEventListener("pointerover", onPointerOver, true);
  return () => {
    if (hoverTimer) clearTimeout(hoverTimer);
    document.removeEventListener("pointerover", onPointerOver, true);
  };
}
