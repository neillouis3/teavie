/**
 * Collapse duplicate catalog rows that share a title + year but have different ids
 * (common with TMDB episode/season stubs). Keeps the richest row (poster, episodes, rating).
 */

export function normalizeCatalogTitle(value) {
  return String(value ?? "").toLowerCase().trim();
}

export function catalogEntryDedupeKey(entry) {
  if (entry == null || typeof entry !== "object") return null;

  const type = entry.type === "movie" ? "movie" : "tv";
  const title = normalizeCatalogTitle(entry.title ?? entry.name ?? "");
  const year = String(
    entry.first_air_date ??
      entry.release_date ??
      entry.firstAirDate ??
      entry.releaseDate ??
      ""
  ).slice(0, 4);

  if (title) {
    if (title.length <= 3) return `${type}:short:${title}`;
    return `${type}:title:${title}|${year}`;
  }
  const id = String(entry.id ?? "").trim();
  if (id) return `${type}:id:${id}`;
  return null;
}

export function catalogEntryRichness(entry) {
  if (entry == null || typeof entry !== "object") return 0;

  let score = 0;
  const poster = entry.poster_path ?? entry.posterPath;
  if (typeof poster === "string" && poster.trim()) score += 10;
  const backdrop = entry.backdrop_path ?? entry.backdropPath;
  if (typeof backdrop === "string" && backdrop.trim()) score += 2;

  const eps = entry.number_of_episodes ?? entry.numberOfEpisodes;
  if (typeof eps === "number" && eps > 1) score += Math.min(eps, 100);

  const vote = Number(entry.vote_average ?? entry.voteAverage);
  if (Number.isFinite(vote) && vote > 0) score += vote;

  const pop = Number(entry.popularity);
  if (Number.isFinite(pop) && pop > 0) score += pop / 50;

  const overview = String(entry.overview ?? "").trim();
  if (overview.length > 20) score += 2;

  return score;
}

/** @template T */
export function dedupeCatalogEntries(entries) {
  /** @type {Map<string, T>} */
  const winners = new Map();
  /** @type {T[]} */
  const list = [];

  for (const entry of entries) {
    if (entry == null) continue;
    list.push(entry);
    const key = catalogEntryDedupeKey(entry);
    if (!key) continue;
    const prev = winners.get(key);
    if (!prev || catalogEntryRichness(entry) > catalogEntryRichness(prev)) {
      winners.set(key, entry);
    }
  }

  const seen = new Set();
  /** @type {T[]} */
  const out = [];
  for (const entry of list) {
    const key = catalogEntryDedupeKey(entry);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    const winner = winners.get(key);
    if (winner) out.push(winner);
  }
  return out;
}
