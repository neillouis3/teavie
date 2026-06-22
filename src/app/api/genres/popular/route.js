/**
 * Popular-genre "algo": ranks the existing TMDB genres by how much popular content
 * the catalog actually holds for each one. We do NOT invent or rename genres — we
 * only reorder the fixed TMDB lists by a popularity score so Discover can surface
 * the genres worth browsing first (Netflix-style "Browse by genre").
 *
 * Score per genre = sum of catalog `popularity` across titles tagged with it.
 * `count` = number of titles in that genre. A few top posters are returned so the
 * Discover tiles can show a small collage.
 */

import clientPromise from "@/lib/mongo";
import {
  catalogMoviePolicyClause,
  catalogTvBrowseNonAnimeClause,
} from "@/lib/catalogQuery";
import { TMDB_MOVIE_GENRES, TMDB_TV_GENRES } from "@/lib/tmdbGenres";

const TILE_POSTERS = 5; // sample posters per genre; UI picks unique leads across tiles

function genreNameMap(list) {
  const map = new Map();
  for (const g of list) map.set(g.id, g.name);
  return map;
}

/**
 * @param {object} cfg
 * @param {Record<string, unknown>} cfg.matchStage
 * @param {number[]} cfg.keys
 * @param {string} cfg.unwindPath  Array field to unwind (e.g. "genre_ids" or "genres").
 * @param {string} cfg.idFieldPath Path to the genre id after unwind (e.g. "genre_ids" or "genres.id").
 * @param {boolean} cfg.withPosters
 */
function buildPipeline({ matchStage, keys, unwindPath, idFieldPath, withPosters }) {
  const group = {
    _id: `$${idFieldPath}`,
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
    { $unwind: `$${unwindPath}` },
    { $match: { [idFieldPath]: { $in: keys } } },
    { $group: group },
    { $sort: { score: -1, count: -1 } },
  ];
}

async function rankGenres(col, matchStage, nameMap, genreFields) {
  const keys = [...nameMap.keys()];
  const { unwindPath, idFieldPath } = genreFields;

  let rows;
  try {
    // `$topN` needs MongoDB 5.2+. Fall back to no posters on older servers.
    rows = await col
      .aggregate(
        buildPipeline({ matchStage, keys, unwindPath, idFieldPath, withPosters: true })
      )
      .toArray();
  } catch {
    rows = await col
      .aggregate(
        buildPipeline({ matchStage, keys, unwindPath, idFieldPath, withPosters: false })
      )
      .toArray();
  }

  return rows
    .filter((r) => nameMap.has(r._id))
    .map((r) => ({
      id: r._id,
      name: nameMap.get(r._id),
      count: r.count,
      posters: (r.posters || [])
        .filter((p) => typeof p === "string" && p.trim().length > 0)
        .slice(0, TILE_POSTERS),
    }));
}

/** Prefer a different lead poster per genre tile (popular titles overlap many genres). */
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

    const [movies, tv] = await Promise.all([
      // Movies tag genres via the numeric `genre_ids` array.
      rankGenres(
        col,
        { type: "movie", ...catalogMoviePolicyClause() },
        genreNameMap(TMDB_MOVIE_GENRES),
        { unwindPath: "genre_ids", idFieldPath: "genre_ids" }
      ),
      // TV shows leave `genre_ids` empty; genres live in `genres: [{ id, name }]`.
      rankGenres(
        col,
        { $and: [{ type: "tv" }, catalogTvBrowseNonAnimeClause()] },
        genreNameMap(TMDB_TV_GENRES),
        { unwindPath: "genres", idFieldPath: "genres.id" }
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
