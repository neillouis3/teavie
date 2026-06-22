const TMDB_SEARCH_URL = "https://api.themoviedb.org/3/search/tv";
const TMDB_SEARCH_MOVIE_URL = "https://api.themoviedb.org/3/search/movie";
const TMDB_EXTERNAL_IDS_URL = "https://api.themoviedb.org/3/tv";
const FETCH_TIMEOUT_MS = 12000;
const MIN_SCORE = 45;

function normalizeText(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function getYear(value) {
  if (typeof value !== "string") return null;
  const m = /^(\d{4})/.exec(value);
  return m ? Number(m[1]) : null;
}

function similarityScore(docTitle, docYear, candidate) {
  const cTitle = candidate?.name || candidate?.original_name || "";
  const cYear = getYear(candidate?.first_air_date || "");
  const nDoc = normalizeText(docTitle);
  const nCand = normalizeText(cTitle);

  let score = 0;
  if (nDoc && nCand) {
    if (nDoc === nCand) score += 80;
    else if (nCand.includes(nDoc) || nDoc.includes(nCand)) score += 60;
  }
  if (docYear != null && cYear != null) {
    const diff = Math.abs(docYear - cYear);
    if (diff === 0) score += 20;
    else if (diff <= 1) score += 12;
    else if (diff <= 2) score += 6;
  }
  score += Number(candidate?.popularity || 0) / 1000;
  return score;
}

async function tmdbFetch(url, token) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  const res = await fetch(url, {
    signal: controller.signal,
    headers: {
      accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
  }).finally(() => clearTimeout(timer));
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`TMDB ${res.status}: ${t.slice(0, 160)}`);
  }
  return res.json();
}

function collectTitleCandidates(doc) {
  const out = [];
  const push = (s) => {
    const t = typeof s === "string" ? s.trim() : "";
    if (!t) return;
    const n = normalizeText(t);
    if (!n) return;
    if (!out.some((x) => normalizeText(x) === n)) out.push(t);
  };
  push(doc.title);
  push(doc.name);
  const al = doc.anilist?.title;
  if (al && typeof al === "object") {
    push(al.english);
    push(al.romaji);
    push(al.native);
  }
  return out;
}

async function searchTmdbTvOnce(title, year, useYear, token) {
  const searchUrl = new URL(TMDB_SEARCH_URL);
  searchUrl.searchParams.set("query", title);
  searchUrl.searchParams.set("include_adult", "false");
  searchUrl.searchParams.set("language", "en-US");
  searchUrl.searchParams.set("page", "1");
  if (useYear && year != null) searchUrl.searchParams.set("first_air_date_year", String(year));

  const payload = await tmdbFetch(searchUrl.toString(), token);
  return Array.isArray(payload?.results) ? payload.results : [];
}

/**
 * Pick best TMDB TV match for a catalog doc (anime or any TV missing tmdb_id).
 * @returns {{ tmdbId: number, imdbId: string|null, poster_path: string|null, backdrop_path: string|null }|null}
 */
export async function resolveTmdbTvFromDoc(doc, token) {
  if (!token) return null;
  const titles = collectTitleCandidates(doc);
  if (!titles.length) return null;
  const year = getYear(doc.first_air_date || doc.release_date || "");
  const nowY = new Date().getFullYear();
  const futureHeavy = year != null && year > nowY + 1;

  let bestOverall = null;
  for (const primaryTitle of titles) {
    for (const useYear of futureHeavy ? [false] : [true, false]) {
      if (useYear && year == null) continue;
      let results = [];
      try {
        results = await searchTmdbTvOnce(primaryTitle, year, useYear, token);
      } catch {
        continue;
      }
      if (!results.length) continue;
      const ranked = results
        .map((row) => ({ row, score: similarityScore(primaryTitle, year, row) }))
        .sort((a, b) => b.score - a.score);
      const best = ranked[0];
      if (!best) continue;
      if (!bestOverall || best.score > bestOverall.score) bestOverall = best;
    }
  }

  if (!bestOverall || bestOverall.score < MIN_SCORE) return null;
  const row = bestOverall.row;
  const tmdbId = Number(row.id);
  if (!Number.isFinite(tmdbId) || tmdbId <= 0) return null;

  let imdbId = null;
  try {
    const extUrl = `${TMDB_EXTERNAL_IDS_URL}/${tmdbId}/external_ids`;
    const ext = await tmdbFetch(extUrl, token);
    imdbId = typeof ext?.imdb_id === "string" ? ext.imdb_id : null;
  } catch {
    // keep null imdb
  }

  const poster_path = row.poster_path || null;
  const backdrop_path = row.backdrop_path || row.poster_path || null;

  return { tmdbId, imdbId, poster_path, backdrop_path };
}

function movieSimilarityScore(docTitle, docYear, candidate) {
  const cTitle = candidate?.title || candidate?.original_title || "";
  const cYear = getYear(candidate?.release_date || "");
  const nDoc = normalizeText(docTitle);
  const nCand = normalizeText(cTitle);

  let score = 0;
  if (nDoc && nCand) {
    if (nDoc === nCand) score += 80;
    else if (nCand.includes(nDoc) || nDoc.includes(nCand)) score += 60;
  }
  if (docYear != null && cYear != null) {
    const diff = Math.abs(docYear - cYear);
    if (diff === 0) score += 20;
    else if (diff <= 1) score += 12;
    else if (diff <= 2) score += 6;
  }
  score += Number(candidate?.popularity || 0) / 1000;
  return score;
}

async function searchTmdbMovieOnce(title, year, useYear, token) {
  const searchUrl = new URL(TMDB_SEARCH_MOVIE_URL);
  searchUrl.searchParams.set("query", title);
  searchUrl.searchParams.set("include_adult", "false");
  searchUrl.searchParams.set("language", "en-US");
  searchUrl.searchParams.set("page", "1");
  if (useYear && year != null) searchUrl.searchParams.set("primary_release_year", String(year));

  const payload = await tmdbFetch(searchUrl.toString(), token);
  return Array.isArray(payload?.results) ? payload.results : [];
}

/**
 * Pick best TMDB movie match for a catalog doc (anime films stored as tv docs).
 * @returns {{ tmdbId: number, poster_path: string|null, backdrop_path: string|null }|null}
 */
export async function resolveTmdbMovieFromDoc(doc, token) {
  if (!token) return null;
  const titles = collectTitleCandidates(doc);
  if (!titles.length) return null;
  const year = getYear(doc.release_date || doc.first_air_date || "");

  let bestOverall = null;
  for (const primaryTitle of titles) {
    for (const useYear of [true, false]) {
      if (useYear && year == null) continue;
      let results = [];
      try {
        results = await searchTmdbMovieOnce(primaryTitle, year, useYear, token);
      } catch {
        continue;
      }
      if (!results.length) continue;
      const ranked = results
        .map((row) => ({ row, score: movieSimilarityScore(primaryTitle, year, row) }))
        .sort((a, b) => b.score - a.score);
      const best = ranked[0];
      if (!best) continue;
      if (!bestOverall || best.score > bestOverall.score) bestOverall = best;
    }
  }

  if (!bestOverall || bestOverall.score < MIN_SCORE) return null;
  const row = bestOverall.row;
  const tmdbId = Number(row.id);
  if (!Number.isFinite(tmdbId) || tmdbId <= 0) return null;

  return {
    tmdbId,
    poster_path: row.poster_path || null,
    backdrop_path: row.backdrop_path || row.poster_path || null,
  };
}
