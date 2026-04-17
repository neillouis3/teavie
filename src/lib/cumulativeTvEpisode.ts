/** TMDB-style seasons: cumulative 1-based index for flat anime embeds (e.g. Videasy /anime/{id}/{ep}). */
export function cumulativeTvEpisode(
  seasons: { season_number: number; episode_count?: number }[] | undefined,
  seasonNum: number,
  episodeNum: number
): number {
  const ep = Math.max(1, Math.floor(Number(episodeNum)) || 1);
  const sn = Math.max(1, Math.floor(Number(seasonNum)) || 1);
  const list = (seasons ?? [])
    .filter((s) => s.season_number >= 1 && (s.episode_count ?? 0) > 0)
    .sort((a, b) => a.season_number - b.season_number);
  if (list.length === 0) return ep;
  let sum = 0;
  for (const s of list) {
    if (s.season_number === sn) {
      const cap = Math.min(ep, Math.max(1, s.episode_count ?? ep));
      return sum + cap;
    }
    if (s.season_number < sn) sum += s.episode_count ?? 0;
  }
  return sum > 0 ? sum + ep : ep;
}
