/**
 * Split-cour anime groups merged into one catalog row + continuous episode list.
 * Primary MAL id is used for the show page; part 2 rows are hidden from browse.
 */

/** @typedef {{ malId: number; episodeCount: number; anilistId?: number }} SplitCourPart */

/** @typedef {{
 *   id: string;
 *   primaryMalId: number;
 *   hiddenMalIds: number[];
 *   parts: SplitCourPart[];
 *   tmdbTvId: number;
 *   tmdbSeason: number;
 * }} SplitCourGroup */

/** Attack on Titan / Shingeki no Kyojin merged cours. */
export const ANIME_SPLIT_COUR_GROUPS = /** @type {SplitCourGroup[]} */ ([
  {
    id: "aot-s3",
    primaryMalId: 35760,
    hiddenMalIds: [38524],
    parts: [
      { malId: 35760, episodeCount: 12, anilistId: 99147 },
      { malId: 38524, episodeCount: 10, anilistId: 104578 },
    ],
    tmdbTvId: 1429,
    tmdbSeason: 3,
  },
  {
    id: "aot-final",
    primaryMalId: 40028,
    hiddenMalIds: [48583],
    parts: [
      { malId: 40028, episodeCount: 16, anilistId: 110277 },
      { malId: 48583, episodeCount: 12, anilistId: 131681 },
    ],
    tmdbTvId: 1429,
    tmdbSeason: 4,
  },
]);

const hiddenMalSet = new Set(
  ANIME_SPLIT_COUR_GROUPS.flatMap((g) => g.hiddenMalIds)
);

const groupByMal = new Map();
for (const group of ANIME_SPLIT_COUR_GROUPS) {
  for (const part of group.parts) {
    groupByMal.set(part.malId, group);
  }
}

/**
 * @param {number | string | null | undefined} malId
 * @returns {SplitCourGroup | null}
 */
export function splitCourGroupForMal(malId) {
  const mal = Math.floor(Number(malId));
  if (!Number.isFinite(mal) || mal <= 0) return null;
  return groupByMal.get(mal) ?? null;
}

/**
 * @param {number | string | null | undefined} malId
 */
export function isHiddenSplitCourMal(malId) {
  const mal = Math.floor(Number(malId));
  return hiddenMalSet.has(mal);
}

/**
 * @param {number | string | null | undefined} malId
 */
export function primaryMalForSplitCourMal(malId) {
  const group = splitCourGroupForMal(malId);
  if (!group) return Math.floor(Number(malId)) || null;
  return group.primaryMalId;
}

/**
 * @param {SplitCourGroup} group
 */
export function mergedSplitCourEpisodeCount(group) {
  return group.parts.reduce((sum, p) => sum + p.episodeCount, 0);
}

/**
 * Map 1-based merged episode index → per-part MAL + episode + TMDB coords.
 * @param {SplitCourGroup} group
 * @param {number} absoluteEpisode
 */
export function resolveSplitCourPlayback(group, absoluteEpisode) {
  const abs = Math.max(1, Math.floor(Number(absoluteEpisode)) || 1);
  const total = mergedSplitCourEpisodeCount(group);
  const capped = Math.min(abs, total);

  let cursor = 0;
  for (const part of group.parts) {
    const start = cursor + 1;
    const end = cursor + part.episodeCount;
    if (capped >= start && capped <= end) {
      const partEpisode = capped - cursor;
      return {
        absoluteEpisode: capped,
        malId: part.malId,
        malEpisode: partEpisode,
        anilistId: part.anilistId ?? null,
        tmdbTvId: String(group.tmdbTvId),
        tmdbSeason: group.tmdbSeason,
        tmdbEpisode: capped,
      };
    }
    cursor += part.episodeCount;
  }

  const last = group.parts[group.parts.length - 1];
  return {
    absoluteEpisode: total,
    malId: last.malId,
    malEpisode: last.episodeCount,
    anilistId: last.anilistId ?? null,
    tmdbTvId: String(group.tmdbTvId),
    tmdbSeason: group.tmdbSeason,
    tmdbEpisode: total,
  };
}

/** Mongo clause: hide merged part-2 catalog rows from anime browse. */
export function catalogAnimeSplitCourHiddenClause() {
  const ids = [...hiddenMalSet].flatMap((mal) => [
    mal,
    String(mal),
    `anime_${mal}`,
  ]);
  return {
    mal_id: { $nin: ids },
    id: { $nin: ids },
  };
}

/**
 * Episode offset when redirecting a hidden part row to its primary show page.
 * @param {number | string | null | undefined} malId
 */
export function splitCourRedirectEpisodeOffset(malId) {
  const group = splitCourGroupForMal(malId);
  const mal = Math.floor(Number(malId));
  if (!group || mal === group.primaryMalId) return 0;
  let offset = 0;
  for (const part of group.parts) {
    if (part.malId === mal) return offset;
    offset += part.episodeCount;
  }
  return 0;
}

/**
 * Map a hidden part MAL + part-local episode → primary MAL + merged absolute episode.
 * @param {number | string | null | undefined} malId
 * @param {number | string | null | undefined} episode
 */
export function normalizeSplitCourMalEpisode(malId, episode = 1) {
  const mal = Math.floor(Number(malId));
  const ep = Math.max(1, Math.floor(Number(episode)) || 1);
  if (!Number.isFinite(mal) || mal <= 0) {
    return { malId: null, episode: ep };
  }
  const group = splitCourGroupForMal(mal);
  if (!group || mal === group.primaryMalId) {
    return { malId: mal, episode: ep };
  }
  return {
    malId: group.primaryMalId,
    episode: splitCourRedirectEpisodeOffset(mal) + ep,
  };
}
