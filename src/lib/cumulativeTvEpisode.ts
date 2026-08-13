/** TMDB-style seasons: cumulative 1-based index for flat anime embeds. */
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

/** Map 1-based absolute episode index across TMDB seasons → TMDB (season, episode) for embeds. */
export function tmdbSeasonEpisodeFromAbsolute(
  seasons: { season_number: number; episode_count?: number }[] | undefined,
  absoluteEp: number
): { season: number; episode: number } {
  const abs = Math.max(1, Math.floor(Number(absoluteEp)) || 1);
  const list = (seasons ?? [])
    .filter((s) => s.season_number >= 1 && (s.episode_count ?? 0) > 0)
    .sort((a, b) => a.season_number - b.season_number);
  if (list.length === 0) return { season: 1, episode: abs };
  let remaining = abs;
  for (const s of list) {
    const cnt = Math.max(1, Math.floor(Number(s.episode_count)) || 0);
    if (remaining <= cnt) {
      return { season: s.season_number, episode: Math.max(1, remaining) };
    }
    remaining -= cnt;
  }
  const last = list[list.length - 1];
  return {
    season: last.season_number,
    episode: Math.max(1, Math.floor(Number(last.episode_count)) || 1),
  };
}
