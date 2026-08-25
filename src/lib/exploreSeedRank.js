/** Freshness window for TMDB seed ranks driving Explore hero / popular / recommended. */
export const EXPLORE_SEED_MAX_AGE_DAYS = 7;

export function exploreSeedCutoffDate() {
  const d = new Date();
  d.setDate(d.getDate() - EXPLORE_SEED_MAX_AGE_DAYS);
  return d;
}

/** Mongo match: seed ranks from a recent `npm run seed:popular`. */
export function exploreSeedFreshClause() {
  return { explore_seed_at: { $gte: exploreSeedCutoffDate() } };
}

/**
 * Mongo $addFields value: seeded rows sort first (rank 1..n), stale/missing sink.
 * @param {"explore_popular_rank" | "explore_trending_rank"} rankField
 */
export function mongoExploreRankSortKeyExpr(rankField) {
  const cutoff = exploreSeedCutoffDate();
  return {
    $cond: [
      {
        $and: [
          { $gte: ["$explore_seed_at", cutoff] },
          { $gt: [`$${rankField}`, 0] },
        ],
      },
      `$${rankField}`,
      999999,
    ],
  };
}
