/**
 * Popular-genre ranking for Discover: ranks IMDb genres by catalog popularity score.
 * Uses canonical `imdb_genres` on every doc (same labels for movies and TV).
 */

import clientPromise from "@/lib/mongo";
import {
  catalogMoviePolicyClause,
  catalogTvBrowseNonAnimeClause,
} from "@/lib/catalogQuery";
import { IMDB_GENRES } from "@/lib/imdbGenres";

const TILE_POSTERS = 5;

/**
 * @param {object} cfg
 * @param {Record<string, unknown>} cfg.matchStage
 * @param {string[]} cfg.labels
 * @param {boolean} cfg.withPosters
 */
function buildPipeline({ matchStage, labels, withPosters }) {
  const group = {
    _id: "$imdb_genres",
    count: { $sum: 1 },
    score: { $sum: "$_pop" },
  };
  if (withPosters) {
    group.posters = {
      $topN: { n: TILE_POSTERS, sortBy: { _pop: -1 }, output: "$poster_path" },
    };
  }
  return [
    { $match: matchStage },
    {
      $addFields: {
        _pop: {
          $convert: { input: "$popularity", to: "double", onError: 0, onNull: 0 },
        },
      },
    },
    { $unwind: "$imdb_genres" },
    { $match: { imdb_genres: { $in: labels } } },
    { $group: group },
    { $sort: { score: -1, count: -1 } },
  ];
}

async function rankImdbGenres(col, matchStage, labels) {
  let rows;
  try {
    rows = await col
      .aggregate(buildPipeline({ matchStage, labels, withPosters: true }))
      .toArray();
  } catch {
    rows = await col
      .aggregate(buildPipeline({ matchStage, labels, withPosters: false }))
      .toArray();
  }

  const slugByLabel = new Map(IMDB_GENRES.map((g) => [g.label, g.slug]));

  return rows
    .filter((r) => labels.includes(r._id))
    .map((r) => ({
      slug: slugByLabel.get(r._id) ?? String(r._id).toLowerCase().replace(/\s+/g, "-"),
      name: r._id,
      count: r.count,
      posters: (r.posters || [])
        .filter((p) => typeof p === "string" && p.trim().length > 0)
        .slice(0, TILE_POSTERS),
    }));
}

function assignUniqueLeadPosters(rows) {
  const used = new Set();
  return rows.map((row) => {
    const pool = row.posters ?? [];
    let lead = pool.find((p) => !used.has(p));
    if (!lead && pool.length) lead = pool[0];
    if (lead) used.add(lead);
    const rest = pool.filter((p) => p !== lead);
    return { ...row, posters: lead ? [lead, ...rest].slice(0, 3) : [] };
  });
}

export async function GET() {
  try {
    const client = await clientPromise;
    const col = client.db("teavie").collection("content");
    const labels = IMDB_GENRES.map((g) => g.label);

    const [movies, tv] = await Promise.all([
      rankImdbGenres(col, { type: "movie", ...catalogMoviePolicyClause() }, labels),
      rankImdbGenres(
        col,
        { $and: [{ type: "tv" }, catalogTvBrowseNonAnimeClause()] },
        labels
      ),
    ]);

    return Response.json({
      movies: assignUniqueLeadPosters(movies),
      tv: assignUniqueLeadPosters(tv),
    });
  } catch (err) {
    console.error(err);
    return Response.json(
      { movies: [], tv: [], error: "popular genres failed" },
      { status: 500 }
    );
  }
}
