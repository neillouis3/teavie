/**
 * Cross-reference TMDB TV ids with catalog / AniList / Jikan when TMDB keywords
 * omit hentai tags.
 */

import { anilistPost } from "./anilistFetch.js";
import { jikanGet } from "./jikanFetch.js";
import {
  isBlockedAdultAnimeDoc,
  normalizeTmdbId,
  shouldSkipAdultAnimeImport,
} from "./animeContentPolicy.js";

const ANILIST_BY_MAL = `query ($idMal: Int) {
  Media(idMal: $idMal, type: ANIME) {
    id idMal genres isAdult format
    title { romaji english native }
    synonyms
  }
}`;

const ANILIST_SEARCH = `query ($search: String, $seasonYear: Int) {
  Page(page: 1, perPage: 8) {
    media(
      type: ANIME
      search: $search
      seasonYear: $seasonYear
      sort: [POPULARITY_DESC, SEARCH_MATCH]
    ) {
      id idMal genres isAdult format seasonYear
      title { romaji english native }
      synonyms
    }
  }
}`;

const CATALOG_POLICY_PROJECTION = {
  id: 1,
  tmdb_id: 1,
  adult: 1,
  rating: 1,
  tags: 1,
  mal_id: 1,
  mal_genre_names: 1,
  imdb_genres: 1,
  "omdb.genre": 1,
  anilist: 1,
  external_ids: 1,
  is_anime: 1,
};

function normalizeTitle(value) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** @param {string} tmdbTitle @param {Record<string, unknown>} media */
export function anilistMediaTitleMatches(tmdbTitle, media) {
  const want = normalizeTitle(tmdbTitle);
  if (!want) return false;
  const candidates = [
    media?.title?.english,
    media?.title?.romaji,
    media?.title?.native,
    ...(Array.isArray(media?.synonyms) ? media.synonyms : []),
  ]
    .map(normalizeTitle)
    .filter(Boolean);
  return candidates.some(
    (c) => c === want || c.startsWith(want) || want.startsWith(c)
  );
}

/** @param {Record<string, unknown> | null | undefined} media */
export function policyDocFromAnilistMedia(media) {
  if (!media || typeof media !== "object") return null;
  const genres = Array.isArray(media.genres)
    ? media.genres.map((g) => String(g ?? "")).filter(Boolean)
    : [];
  return {
    type: "tv",
    mal_id: typeof media.idMal === "number" ? media.idMal : null,
    anilist: {
      id: media.id ?? null,
      idMal: media.idMal ?? null,
      isAdult: media.isAdult === true,
      genres,
      format: media.format ?? null,
    },
    mal_genre_names: genres.includes("Hentai") ? ["Hentai"] : [],
  };
}

/** @param {Record<string, unknown> | null | undefined} anime Jikan /anime/{id} data */
export function policyDocFromJikanAnime(anime) {
  if (!anime || typeof anime !== "object") return null;
  const genres = Array.isArray(anime.genres)
    ? anime.genres.map((g) => String(g?.name ?? "")).filter(Boolean)
    : [];
  return {
    type: "tv",
    mal_id: anime.mal_id ?? null,
    rating: typeof anime.rating === "string" ? anime.rating : null,
    mal_genre_names: genres,
    tags: anime.rating ? [String(anime.rating).toLowerCase()] : [],
  };
}

/** @param {import('mongodb').Collection | null | undefined} collection @param {number} tmdbId */
export async function lookupCatalogPolicyDocByTmdbId(collection, tmdbId) {
  const id = normalizeTmdbId(tmdbId);
  if (id == null || !collection) return null;
  const idStr = String(id);
  return collection.findOne(
    {
      type: "tv",
      $or: [
        { tmdb_id: id },
        { id },
        { id: idStr },
        { "external_ids.tmdb_id": id },
      ],
    },
    { projection: CATALOG_POLICY_PROJECTION }
  );
}

/** @param {number} malId */
export async function fetchAnilistPolicyByMalId(malId) {
  const id = normalizeTmdbId(malId);
  if (id == null) return null;
  try {
    const res = await anilistPost({
      query: ANILIST_BY_MAL,
      variables: { idMal: id },
    });
    if (!res.ok) return null;
    const payload = await res.json();
    return payload?.data?.Media ?? null;
  } catch {
    return null;
  }
}

/** @param {string} title @param {number | null | undefined} year */
export async function searchAnilistPolicyByTitle(title, year) {
  const q = String(title ?? "").trim();
  if (!q) return null;
  const seasonYear =
    typeof year === "number" && Number.isFinite(year) && year >= 1960 ? year : undefined;
  try {
    const res = await anilistPost({
      query: ANILIST_SEARCH,
      variables: { search: q, seasonYear },
    });
    if (!res.ok) return null;
    const payload = await res.json();
    const rows = payload?.data?.Page?.media;
    if (!Array.isArray(rows) || rows.length === 0) return null;

    const exact = rows.find((m) => anilistMediaTitleMatches(q, m));
    if (exact) return exact;

    if (seasonYear != null) {
      const yearMatch = rows.find(
        (m) => Number(m?.seasonYear) === seasonYear && anilistMediaTitleMatches(q, m)
      );
      if (yearMatch) return yearMatch;
    }

    return rows.find((m) => anilistMediaTitleMatches(q, m)) ?? null;
  } catch {
    return null;
  }
}

/** @param {number} malId */
export async function fetchJikanPolicyByMalId(malId) {
  const id = normalizeTmdbId(malId);
  if (id == null) return null;
  try {
    const res = await jikanGet(`anime/${id}`);
    if (!res.ok) return null;
    const payload = await res.json();
    return payload?.data ?? null;
  } catch {
    return null;
  }
}

function yearFromTmdbProbe(probe) {
  const raw = probe?.first_air_date ?? probe?.release_date ?? "";
  if (typeof raw !== "string" || raw.length < 4) return null;
  const y = Number(raw.slice(0, 4));
  return Number.isFinite(y) ? y : null;
}

/**
 * Resolve MAL / AniList / catalog policy signals for a TMDB TV row.
 * @param {number} tmdbId
 * @param {Record<string, unknown> | null | undefined} probe TMDB probe object
 * @param {{ collection?: import('mongodb').Collection | null }} [opts]
 */
export async function enrichTmdbTvPolicySources(tmdbId, probe, opts = {}) {
  /** @type {Record<string, unknown>[]} */
  const docs = [];
  const id = normalizeTmdbId(tmdbId);
  if (id == null) return docs;

  const catalogDoc = await lookupCatalogPolicyDocByTmdbId(opts.collection, id);
  if (catalogDoc) docs.push(catalogDoc);

  const title = String(probe?.name ?? probe?.title ?? "").trim();
  const year = yearFromTmdbProbe(probe);

  let anilist =
    catalogDoc?.mal_id != null
      ? await fetchAnilistPolicyByMalId(Number(catalogDoc.mal_id))
      : null;
  if (!anilist && title) {
    anilist = await searchAnilistPolicyByTitle(title, year);
  }
  if (anilist) {
    docs.push(policyDocFromAnilistMedia(anilist));

    const malFromAni = normalizeTmdbId(anilist.idMal);
    if (malFromAni != null) {
      const jikan = await fetchJikanPolicyByMalId(malFromAni);
      if (jikan) docs.push(policyDocFromJikanAnime(jikan));
    }
  } else if (catalogDoc?.mal_id != null) {
    const jikan = await fetchJikanPolicyByMalId(Number(catalogDoc.mal_id));
    if (jikan) docs.push(policyDocFromJikanAnime(jikan));
  }

  return docs;
}

/** @param {Record<string, unknown>[]} docs */
export function isBlockedByPolicyDocs(docs) {
  for (const doc of docs) {
    if (isBlockedAdultAnimeDoc(doc)) return true;
  }
  return false;
}

/**
 * Full adult check for a TMDB TV id (TMDB probe + catalog + AniList + Jikan).
 * @param {number} tmdbId
 * @param {Record<string, unknown> | null | undefined} probe
 * @param {{ collection?: import('mongodb').Collection | null }} [opts]
 */
export async function isBlockedAdultTmdbTvShowEnriched(tmdbId, probe, opts = {}) {
  const sources = await enrichTmdbTvPolicySources(tmdbId, probe, opts);
  if (isBlockedByPolicyDocs(sources)) return true;

  for (const doc of sources) {
    const malId = normalizeTmdbId(doc?.mal_id ?? doc?.anilist?.idMal);
    const anilist = doc?.anilist ?? null;
    if (malId != null || anilist) {
      const jikanStub = doc.mal_genre_names
        ? { genres: (doc.mal_genre_names || []).map((name) => ({ name })), rating: doc.rating }
        : null;
      if (shouldSkipAdultAnimeImport(jikanStub, anilist)) return true;
    }
  }

  return false;
}
