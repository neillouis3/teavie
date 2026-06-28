/**
 * IMDb genre ranking for explore + genres index.
 */

import clientPromise from "@/lib/mongo";
import { catalogMoviePolicyClause } from "@/lib/catalogQuery";
import { IMDB_GENRES } from "@/lib/imdbGenres";

const TILE_POSTERS = 5;

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

async function rankImdbGenres(col, matchStage, labels, posterMatchStage) {
  let countRows;
  try {
    countRows = await col
      .aggregate(buildPipeline({ matchStage, labels, withPosters: false }))
      .toArray();
  } catch {
    countRows = [];
  }

  let posterRows = [];
  if (posterMatchStage) {
    try {
      posterRows = await col
        .aggregate(
          buildPipeline({ matchStage: posterMatchStage, labels, withPosters: true })
        )
        .toArray();
    } catch {
      posterRows = [];
    }
  }

  const postersByLabel = new Map(
    posterRows.map((r) => [
      r._id,
      (r.posters || [])
        .filter((p) => typeof p === "string" && p.trim().length > 0)
        .slice(0, TILE_POSTERS),
    ])
  );

  const slugByLabel = new Map(IMDB_GENRES.map((g) => [g.label, g.slug]));

  return countRows
    .filter((r) => labels.includes(r._id))
    .map((r) => ({
      slug: slugByLabel.get(r._id) ?? String(r._id).toLowerCase().replace(/\s+/g, "-"),
      name: r._id,
      count: r.count,
      posters: postersByLabel.get(r._id) ?? [],
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

export async function loadPopularGenres(sortByName = false) {
  const client = await clientPromise;
  const col = client.db("teavie").collection("content");
  const labels = IMDB_GENRES.map((g) => g.label);

  const matchStage = {
    $or: [
      { $and: [{ type: "movie" }, catalogMoviePolicyClause()] },
      { type: "tv" },
    ],
    imdb_genres: { $exists: true, $not: { $size: 0 } },
  };

  const moviePosterStage = {
    $and: [
      { type: "movie" },
      catalogMoviePolicyClause(),
      { imdb_genres: { $exists: true, $not: { $size: 0 } } },
      { poster_path: { $type: "string", $ne: "" } },
    ],
  };

  return assignUniqueLeadPosters(
    await rankImdbGenres(col, matchStage, labels, moviePosterStage)
  ).sort((a, b) =>
    sortByName
      ? a.name.localeCompare(b.name)
      : b.count - a.count || a.name.localeCompare(b.name)
  );
}
