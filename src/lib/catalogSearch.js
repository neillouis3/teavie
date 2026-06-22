/**
 * Search-algo helpers shared by /api/search.
 *
 * Genre matching uses canonical `imdb_genres` on catalog docs (same labels for
 * movies and TV). Actor matching still resolves through TMDB credits.
 */

import { IMDB_GENRES } from "@/lib/imdbGenres";

const KDrama_QUERY_ALIASES = [
  "kdrama",
  "k-drama",
  "k drama",
  "korean drama",
  "korean dramas",
  "k-dramas",
  "kdramas",
];

/** Common spoken aliases -> IMDb genre labels. */
const GENRE_ALIASES = {
  "sci fi": ["Sci-Fi"],
  scifi: ["Sci-Fi"],
  "sci-fi": ["Sci-Fi"],
  "science fiction": ["Sci-Fi"],
  "rom com": ["Romance", "Comedy"],
  romcom: ["Romance", "Comedy"],
  "romantic comedy": ["Romance", "Comedy"],
  cartoon: ["Animation"],
  cartoons: ["Animation"],
  anime: ["Animation"],
  docs: ["Documentary"],
  documentaries: ["Documentary"],
  scary: ["Horror"],
  superhero: ["Action", "Sci-Fi"],
  superheroes: ["Action", "Sci-Fi"],
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

function genreNameMatches(norm, tokens, name) {
  const lowered = name.toLowerCase();
  const nameTokens = tokenize(lowered);
  if (norm === lowered) return true;
  if (nameTokens.length > 1 && nameTokens.every((t) => tokens.includes(t)))
    return true;
  if (nameTokens.length === 1 && lowered.length >= 4 && tokens.includes(lowered))
    return true;
  if (
    nameTokens.length > 1 &&
    nameTokens[0].length >= 3 &&
    tokens.includes(nameTokens[0])
  ) {
    return true;
  }
  return false;
}

/**
 * Detect whether a query names a genre (e.g. "comedy", "sci-fi", "best action").
 * @param {string} q
 * @returns {{ imdbLabels: string[]; kdrama: boolean }}
 */
export function detectGenres(q) {
  const norm = String(q || "").trim().toLowerCase();
  if (!norm) return { imdbLabels: [], kdrama: false };

  const tokens = tokenize(norm);
  const imdbLabels = new Set();

  for (const [alias, labels] of Object.entries(GENRE_ALIASES)) {
    const aliasTokens = alias.split(" ");
    const hit =
      norm === alias ||
      (aliasTokens.length === 1 && tokens.includes(alias)) ||
      (aliasTokens.length > 1 && aliasTokens.every((t) => tokens.includes(t)));
    if (hit) for (const label of labels) imdbLabels.add(label);
  }

  for (const g of IMDB_GENRES) {
    if (genreNameMatches(norm, tokens, g.label)) {
      imdbLabels.add(g.label);
    }
    if (norm === g.slug || tokens.includes(g.slug)) {
      imdbLabels.add(g.label);
    }
  }

  const kdrama = KDrama_QUERY_ALIASES.some(
    (alias) => norm === alias || (alias.includes(" ") && norm.includes(alias))
  );

  return { imdbLabels: [...imdbLabels], kdrama };
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
