import clientPromise from "@/lib/mongo";
import {
  catalogImdbGenreMatchClause,
  catalogKdramaClause,
  catalogTvBrowseReleasedClause,
  catalogTodayIsoUtc,
} from "@/lib/catalogQuery";
import { mongoMixedTvCatalogPopularityExpr } from "@/lib/catalogPopularity";
import {
  catalogDocReleaseDateString,
  runtimeSecondsFromDoc,
  tvEpisodeCountFromDoc,
  tvSeasonCountFromDoc,
} from "@/lib/mapContentDocToItem";
import { catalogDisplayVoteAverage, catalogPopularityScore } from "@/lib/catalogPopularity";
import { IMDB_GENRES } from "@/lib/imdbGenres";

const TILE_POSTERS = 5;
const RAIL_LIMIT = 24;
const GENRE_TILE_LIMIT = 12;

function mapKdramaRow(doc) {
  const release_date = catalogDocReleaseDateString(doc);
  return {
    id: doc.id.toString(),
    title: doc.title ?? doc.name,
    release_date,
    runtimeSeconds: runtimeSecondsFromDoc(doc),
    season_amount: tvSeasonCountFromDoc(doc),
    number_of_episodes: tvEpisodeCountFromDoc(doc),
    popularity: catalogPopularityScore(doc),
    vote_average: catalogDisplayVoteAverage(doc),
    poster_path: doc.poster_path ?? null,
    backdrop_path: doc.backdrop_path ?? null,
    type: "tv",
  };
}

function kdramaReleasedFilter() {
  return {
    $and: [
      catalogKdramaClause(),
      catalogTvBrowseReleasedClause("first_air_date", catalogTodayIsoUtc()),
    ],
  };
}

async function popularRail(col, extraClause, limit = RAIL_LIMIT) {
  const filter = extraClause
    ? { $and: [kdramaReleasedFilter(), extraClause] }
    : kdramaReleasedFilter();

  const rows = await col
    .aggregate([
      { $match: filter },
      { $addFields: { _catalogPop: mongoMixedTvCatalogPopularityExpr() } },
      { $sort: { _catalogPop: -1, _id: -1 } },
      { $limit: limit },
      { $project: { _catalogPop: 0 } },
    ])
    .toArray();

  return rows.map(mapKdramaRow);
}

function buildGenrePipeline(matchStage, labels, withPosters) {
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
    { $limit: GENRE_TILE_LIMIT },
  ];
}

async function rankKdramaGenres(col) {
  const labels = IMDB_GENRES.map((g) => g.label);
  const matchStage = kdramaReleasedFilter();
  let rows;
  try {
    rows = await col
      .aggregate(buildGenrePipeline(matchStage, labels, true))
      .toArray();
  } catch {
    rows = await col
      .aggregate(buildGenrePipeline(matchStage, labels, false))
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
        .slice(0, 3),
    }));
}

export async function GET() {
  try {
    const client = await clientPromise;
    const col = client.db("teavie").collection("content");

    const romanceClause = catalogImdbGenreMatchClause("romance");
    const dramaClause = catalogImdbGenreMatchClause("drama");

    const [popular, romance, drama, genres] = await Promise.all([
      popularRail(col),
      romanceClause ? popularRail(col, romanceClause) : [],
      dramaClause ? popularRail(col, dramaClause) : [],
      rankKdramaGenres(col),
    ]);

    return Response.json({ popular, romance, drama, genres });
  } catch (err) {
    console.error(err);
    return Response.json(
      { popular: [], romance: [], drama: [], genres: [], error: "K-Drama discover failed" },
      { status: 500 }
    );
  }
}
