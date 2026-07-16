import { anilistPost } from "@/lib/anilistFetch";
import { jikanGet } from "@/lib/jikanFetch";
import { tmdbAuth, tmdbFetchJson } from "@/lib/tmdbAuth";

const ANIZIP_MAPPINGS = "https://api.ani.zip/mappings";
const TMDB_IMG = "https://image.tmdb.org/t/p/w780";

/** Prefer promo / key art; skip logos and character portraits. */
const ANIZIP_COVER_TYPES = new Set(["Poster", "Banner", "Fanart", "Background"]);

/**
 * @param {unknown} row
 * @returns {string}
 */
function pictureUrlFromJikanRow(row) {
  if (!row || typeof row !== "object") return "";
  const jpg = /** @type {{ large_image_url?: string; image_url?: string }} */ (
    /** @type {{ jpg?: unknown }} */ (row).jpg
  );
  const webp = /** @type {{ large_image_url?: string; image_url?: string }} */ (
    /** @type {{ webp?: unknown }} */ (row).webp
  );
  const candidates = [
    jpg?.large_image_url,
    webp?.large_image_url,
    jpg?.image_url,
    webp?.image_url,
  ];
  for (const c of candidates) {
    if (typeof c === "string" && c.trim()) return c.trim();
  }
  return "";
}

/**
 * @param {number} idMal
 * @returns {Promise<{ url: string; source: string; label?: string }[]>}
 */
async function artworkFromJikanPictures(idMal) {
  const res = await jikanGet(`anime/${idMal}/pictures`, { maxAttempts: 2 });
  if (!res.ok) return [];
  const json = await res.json().catch(() => null);
  const rows = Array.isArray(json?.data) ? json.data : [];
  /** @type {{ url: string; source: string; label?: string }[]} */
  const out = [];
  const seen = new Set();
  for (const row of rows) {
    const url = pictureUrlFromJikanRow(row);
    if (!url || seen.has(url)) continue;
    seen.add(url);
    out.push({ url, source: "mal", label: "Artwork" });
  }
  return out;
}

/**
 * @param {number} idMal
 * @returns {Promise<{
 *   images: { url: string; source: string; label?: string }[];
 *   tmdbId: number | null;
 *   anilistId: number | null;
 * }>}
 */
async function artworkFromAnizip(idMal) {
  const res = await fetch(`${ANIZIP_MAPPINGS}?mal_id=${idMal}`, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) return { images: [], tmdbId: null, anilistId: null };
  const json = await res.json().catch(() => null);
  const rows = Array.isArray(json?.images) ? json.images : [];
  /** @type {{ url: string; source: string; label?: string }[]} */
  const images = [];
  const seen = new Set();
  for (const row of rows) {
    const type = typeof row?.coverType === "string" ? row.coverType : "";
    if (!ANIZIP_COVER_TYPES.has(type)) continue;
    const url = typeof row?.url === "string" ? row.url.trim() : "";
    if (!url || seen.has(url)) continue;
    seen.add(url);
    images.push({ url, source: "anizip", label: type });
  }

  const mappings = json?.mappings && typeof json.mappings === "object" ? json.mappings : {};
  const tmdbRaw = Number(mappings.themoviedb_id ?? mappings.tmdb_id);
  const aniRaw = Number(mappings.anilist_id);
  return {
    images,
    tmdbId: Number.isFinite(tmdbRaw) && tmdbRaw > 0 ? tmdbRaw : null,
    anilistId: Number.isFinite(aniRaw) && aniRaw > 0 ? aniRaw : null,
  };
}

/**
 * @param {number} tmdbId
 * @returns {Promise<{ url: string; source: string; label?: string }[]>}
 */
async function artworkFromTmdb(tmdbId) {
  const auth = tmdbAuth();
  if (!auth || !Number.isFinite(tmdbId) || tmdbId <= 0) return [];

  const data = await tmdbFetchJson(
    `https://api.themoviedb.org/3/tv/${tmdbId}/images`,
    auth
  );
  if (!data || typeof data !== "object") return [];

  /** @type {{ url: string; source: string; label?: string }[]} */
  const out = [];
  const seen = new Set();

  /** @param {unknown[]} rows @param {string} label */
  const pushRows = (rows, label) => {
    if (!Array.isArray(rows)) return;
    for (const row of rows) {
      const path =
        row && typeof row === "object" && typeof row.file_path === "string"
          ? row.file_path.trim()
          : "";
      if (!path.startsWith("/")) continue;
      const url = `${TMDB_IMG}${path}`;
      if (seen.has(url)) continue;
      seen.add(url);
      out.push({ url, source: "tmdb", label });
    }
  };

  // Backdrops first (widescreen key art), then posters — Miruro-style promo grid.
  pushRows(data.backdrops, "Fanart");
  pushRows(data.posters, "Poster");
  return out;
}

/**
 * Cover + banner only (no character portraits).
 * @param {number} idMal
 * @returns {Promise<{ url: string; source: string; label?: string }[]>}
 */
async function artworkFromAnilistCovers(idMal) {
  const query = `query ($idMal: Int) {
    Media(idMal: $idMal, type: ANIME) {
      coverImage { extraLarge large }
      bannerImage
    }
  }`;

  const res = await anilistPost({ query, variables: { idMal } });
  if (!res.ok) return [];
  const payload = await res.json().catch(() => null);
  const media = payload?.data?.Media;
  if (!media) return [];

  /** @type {{ url: string; source: string; label?: string }[]} */
  const out = [];
  const seen = new Set();
  /** @param {string | null | undefined} url @param {string} label */
  const push = (url, label) => {
    const u = typeof url === "string" ? url.trim() : "";
    if (!u || seen.has(u)) return;
    seen.add(u);
    out.push({ url: u, source: "anilist", label });
  };

  push(media.coverImage?.extraLarge || media.coverImage?.large, "Poster");
  push(media.bannerImage, "Banner");
  return out;
}

/**
 * @param {{ url: string; source: string; label?: string }[]} items
 */
function dedupeArtwork(items) {
  /** @type {{ url: string; source: string; label?: string }[]} */
  const out = [];
  const seen = new Set();
  for (const item of items) {
    const url = typeof item?.url === "string" ? item.url.trim() : "";
    if (!url || seen.has(url)) continue;
    seen.add(url);
    out.push(item);
  }
  return out;
}

/**
 * Promo artwork gallery for an anime show page (Miruro-style).
 * Prefers MAL pictures + TMDB / AniZip key art. Never includes character portraits.
 *
 * @param {number} idMal
 * @returns {Promise<{ url: string; source: string; label?: string }[]>}
 */
export async function loadAnimeArtwork(idMal) {
  if (!Number.isFinite(idMal) || idMal <= 0) return [];

  const [malResult, anizipResult] = await Promise.allSettled([
    artworkFromJikanPictures(idMal),
    artworkFromAnizip(idMal),
  ]);

  const fromMal = malResult.status === "fulfilled" ? malResult.value : [];
  const anizip =
    anizipResult.status === "fulfilled"
      ? anizipResult.value
      : { images: [], tmdbId: null, anilistId: null };

  if (malResult.status === "rejected") {
    console.error("[animeArtwork] jikan pictures", malResult.reason);
  }
  if (anizipResult.status === "rejected") {
    console.error("[animeArtwork] anizip", anizipResult.reason);
  }

  /** @type {{ url: string; source: string; label?: string }[]} */
  let fromTmdb = [];
  if (anizip.tmdbId) {
    try {
      fromTmdb = await artworkFromTmdb(anizip.tmdbId);
    } catch (err) {
      console.error("[animeArtwork] tmdb images", err);
    }
  }

  let merged = dedupeArtwork([
    ...fromMal,
    ...fromTmdb,
    ...anizip.images,
  ]);

  if (merged.length === 0) {
    try {
      merged = await artworkFromAnilistCovers(idMal);
    } catch (err) {
      console.error("[animeArtwork] anilist covers", err);
    }
  }

  return merged;
}
