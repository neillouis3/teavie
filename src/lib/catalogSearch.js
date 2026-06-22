/**
 * Search-algo helpers shared by /api/search.
 *
 * The catalog (`teavie.content`) only stores title/name, overview, tagline and
 * genres — there is no cast data. So:
 *  - genre + keyword matching happen directly against catalog fields, and
 *  - actor matching is resolved through TMDB (person search + credits) and then
 *    mapped back onto catalog documents by their TMDB id.
 */

import { TMDB_MOVIE_GENRES, TMDB_TV_GENRES } from "@/lib/tmdbGenres";

const ALL_GENRES = [...TMDB_MOVIE_GENRES, ...TMDB_TV_GENRES];

/** Common spoken aliases -> TMDB genre ids (movie + tv). */
const GENRE_ALIASES = {
  "sci fi": [878, 10765],
  scifi: [878, 10765],
  "sci-fi": [878, 10765],
  "science fiction": [878, 10765],
  "rom com": [10749, 35],
  romcom: [10749, 35],
  "romantic comedy": [10749, 35],
  cartoon: [16],
  cartoons: [16],
  anime: [16],
  docs: [99],
  documentaries: [99],
  scary: [27],
  superhero: [28, 878],
  superheroes: [28, 878],
};

/** TV credit genres that are mostly guest spots, not real roles (talk/news/reality). */
const ACTOR_TV_EXCLUDE_GENRES = new Set([10767, 10763, 10764]);

function tokenize(s) {
  return String(s || "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

function isExcludedTvCredit(item) {
  const genreIds = Array.isArray(item?.genre_ids) ? item.genre_ids : [];
  return genreIds.some((g) => ACTOR_TV_EXCLUDE_GENRES.has(g));
}

/**
 * Detect whether a query names a genre (e.g. "comedy", "sci-fi", "best action").
 * Conservative on purpose so titles like "War of the Worlds" don't trigger a
 * whole-genre dump.
 * @param {string} q
 * @returns {{ ids: number[]; names: string[] }}
 */
export function detectGenres(q) {
  const norm = String(q || "").trim().toLowerCase();
  if (!norm) return { ids: [], names: [] };

  const tokens = tokenize(norm);
  const ids = new Set();
  const names = new Set();

  for (const [alias, gids] of Object.entries(GENRE_ALIASES)) {
    const aliasTokens = alias.split(" ");
    const hit =
      norm === alias ||
      (aliasTokens.length === 1 && tokens.includes(alias)) ||
      (aliasTokens.length > 1 && aliasTokens.every((t) => tokens.includes(t)));
    if (hit) for (const gid of gids) ids.add(gid);
  }

  for (const g of ALL_GENRES) {
    const name = g.name.toLowerCase();
    const nameTokens = tokenize(name);
    let hit = false;
    if (norm === name) hit = true;
    else if (nameTokens.length > 1 && nameTokens.every((t) => tokens.includes(t)))
      hit = true;
    else if (nameTokens.length === 1 && name.length >= 4 && tokens.includes(name))
      hit = true;
    // Single-word query naming the lead word of a combined genre, e.g.
    // "war" -> "War & Politics", "action" -> "Action & Adventure".
    else if (
      nameTokens.length > 1 &&
      nameTokens[0].length >= 3 &&
      tokens.includes(nameTokens[0])
    )
      hit = true;
    if (hit) {
      ids.add(g.id);
      names.add(g.name);
    }
  }

  return { ids: [...ids], names: [...names] };
}

async function fetchWithTimeout(url, opts, ms) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...opts, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Resolve a query to TMDB ids of titles the matched actor(s) appear in.
 * Returns empty arrays when the query doesn't look like a person or TMDB is
 * unavailable, so callers can always merge the result safely.
 * @param {string} q
 * @param {string} token TMDB bearer token
 * @returns {Promise<{ movieIds: number[]; tvIds: number[]; people: {id:number;name:string}[] }>}
 */
export async function fetchActorCreditIds(q, token, { timeoutMs = 2500 } = {}) {
  const empty = { movieIds: [], tvIds: [], people: [] };
  const query = String(q || "").trim();
  if (!token || query.length < 3) return empty;

  const headers = { accept: "application/json", Authorization: `Bearer ${token}` };
  const norm = query.toLowerCase();
  const qTokens = tokenize(norm);

  let people = [];
  try {
    const res = await fetchWithTimeout(
      `https://api.themoviedb.org/3/search/person?include_adult=false&query=${encodeURIComponent(
        query
      )}`,
      { headers, next: { revalidate: 86400 } },
      timeoutMs
    );
    if (!res.ok) return empty;
    const json = await res.json().catch(() => null);
    people = Array.isArray(json?.results) ? json.results : [];
  } catch {
    return empty;
  }

  const nameMatches = (name) => {
    const n = String(name || "").toLowerCase();
    if (!n) return false;
    if (n === norm || n.includes(norm) || norm.includes(n)) return true;
    const nTokens = tokenize(n);
    const overlap = nTokens.filter((t) => t.length > 2 && qTokens.includes(t));
    if (qTokens.length === 1) return overlap.length >= 1;
    return overlap.length >= Math.min(2, nTokens.length);
  };

  const candidates = people
    .filter(
      (p) =>
        p &&
        (p.known_for_department === "Acting" || p.known_for_department == null)
    )
    .filter((p) => nameMatches(p.name))
    .sort((a, b) => (b.popularity || 0) - (a.popularity || 0))
    .slice(0, 2);

  if (candidates.length === 0) return empty;

  const movieIds = new Set();
  const tvIds = new Set();

  for (const p of candidates) {
    for (const k of p.known_for || []) {
      if (!k || !k.id) continue;
      if (k.media_type === "movie") movieIds.add(k.id);
      else if (k.media_type === "tv" && !isExcludedTvCredit(k)) tvIds.add(k.id);
    }
  }

  // Fuller credit list for the strongest match.
  try {
    const top = candidates[0];
    const res = await fetchWithTimeout(
      `https://api.themoviedb.org/3/person/${top.id}/combined_credits`,
      { headers, next: { revalidate: 86400 } },
      timeoutMs
    );
    if (res.ok) {
      const json = await res.json().catch(() => null);
      const cast = Array.isArray(json?.cast) ? json.cast : [];
      cast.sort((a, b) => (b.popularity || 0) - (a.popularity || 0));
      for (const c of cast.slice(0, 80)) {
        if (!c || !c.id) continue;
        if (c.media_type === "movie") movieIds.add(c.id);
        else if (c.media_type === "tv" && !isExcludedTvCredit(c)) tvIds.add(c.id);
      }
    }
  } catch {
    // known_for ids alone are still useful
  }

  return {
    movieIds: [...movieIds],
    tvIds: [...tvIds],
    people: candidates.map((p) => ({ id: p.id, name: p.name })),
  };
}
