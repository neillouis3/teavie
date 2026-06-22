/**
 * Catalog search over `teavie.content`. Matches on, in priority order:
 *  1. Title / name (with relevance: exact > prefix > contains)
 *  2. Keywords — words appearing in overview / tagline
 *  3. Genre — when the query names a genre (e.g. "comedy", "sci-fi")
 *  4. Actor — titles the searched actor appears in (resolved via TMDB credits)
 *
 * Branches preserve the existing audience/released rules:
 *  - Movies: released `release_date`
 *  - Anime TV: `anime_*` ids + lenient first-air rule
 *  - Other TV: legacy duplicate anime excluded; released `first_air_date`
 */

import clientPromise from "@/lib/mongo";
import {
  animeTitleSearchConditions,
  catalogAnimeIdMongoExpr,
  catalogMovieHideAdultClause,
  catalogTodayIsoUtc,
  escapeRegex,
  releasedAnimeFirstAirClause,
  releasedCatalogClause,
} from "@/lib/catalogQuery";
import { detectGenres, fetchActorCreditIds } from "@/lib/catalogSearch";
import { tmdbBearerToken } from "@/lib/tmdbAuth";
import { mapContentDocToItem } from "@/lib/mapContentDocToItem";

const DEFAULT_LIMIT = 28;

const notAnimeTv = {
  $nor: [{ is_anime: true }, { tags: "anime" }],
};

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const q = (searchParams.get("q") || "").trim();
    const clientPage = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(
      40,
      Math.max(1, parseInt(searchParams.get("limit") || String(DEFAULT_LIMIT), 10))
    );

    if (!q) {
      return Response.json({
        page: 1,
        limit,
        total: 0,
        totalPages: 0,
        results: [],
      });
    }

    const safe = escapeRegex(q);
    const lowered = q.toLowerCase();
    const safeLower = escapeRegex(lowered);

    // --- Keyword / title conditions (title, name, overview, tagline) ---
    const textConds = [
      { title: { $regex: safe, $options: "i" } },
      { name: { $regex: safe, $options: "i" } },
      { overview: { $regex: safe, $options: "i" } },
      { tagline: { $regex: safe, $options: "i" } },
    ];

    // --- Genre conditions ---
    const { ids: genreIds } = detectGenres(q);
    const genreConds = genreIds.length
      ? [
          { genre_ids: { $in: genreIds } },
          { genres: { $elemMatch: { id: { $in: genreIds } } } },
        ]
      : [];

    // --- Actor conditions (TMDB credits -> catalog by TMDB id) ---
    const token = tmdbBearerToken();
    const { movieIds, tvIds } = await fetchActorCreditIds(q, token);
    const actorMovieCond = movieIds.length
      ? [{ id: { $in: [...movieIds, ...movieIds.map(String)] } }]
      : [];
    const actorTvCond = tvIds.length
      ? [
          {
            $or: [
              { id: { $in: [...tvIds, ...tvIds.map(String)] } },
              { tmdb_id: { $in: tvIds } },
              { "external_ids.tmdb_id": { $in: tvIds } },
            ],
          },
        ]
      : [];

    const todayIso = catalogTodayIsoUtc();
    const includeUnreleased = searchParams.get("include_unreleased") === "1";

    const movieBranch = {
      $and: [
        { type: "movie" },
        { $or: [...textConds, ...genreConds, ...actorMovieCond] },
        ...(includeUnreleased
          ? []
          : [releasedCatalogClause("release_date", todayIso)]),
        catalogMovieHideAdultClause(),
      ],
    };

    const tvAnimeBranch = {
      $and: [
        { type: "tv" },
        {
          $or: [
            ...animeTitleSearchConditions(safe),
            { overview: { $regex: safe, $options: "i" } },
            { tagline: { $regex: safe, $options: "i" } },
          ],
        },
        catalogAnimeIdMongoExpr(),
        ...(includeUnreleased ? [] : [releasedAnimeFirstAirClause(todayIso)]),
      ],
    };

    const tvLiveBranch = {
      $and: [
        { type: "tv" },
        { $or: [...textConds, ...genreConds, ...actorTvCond] },
        notAnimeTv,
        ...(includeUnreleased
          ? []
          : [releasedCatalogClause("first_air_date", todayIso)]),
      ],
    };

    const filter = { $or: [movieBranch, tvAnimeBranch, tvLiveBranch] };

    const client = await clientPromise;
    const col = client.db("teavie").collection("content");
    const skip = (clientPage - 1) * limit;

    // Catalog ids matched purely via actor credits — used for a relevance nudge so
    // an actor's films outrank loose keyword hits.
    const actorBoostIds = [
      ...movieIds,
      ...movieIds.map(String),
      ...tvIds,
      ...tvIds.map(String),
    ];

    // Normalize popularity for ranking: anime `popularity` (AniList scale) is ~1000x
    // larger than TMDB popularity, so divide it down to compare fairly.
    const popDouble = {
      $convert: { input: "$popularity", to: "double", onError: 0, onNull: 0 },
    };
    const popExpr = {
      $cond: [
        { $regexMatch: { input: { $toString: "$id" }, regex: "^anime_" } },
        { $divide: [popDouble, 1000] },
        popDouble,
      ],
    };

    // Relevance: exact title/name (1000) > prefix (300) > contains (120),
    // then catalog popularity.
    const relevancePipeline = [
      { $match: filter },
      {
        $addFields: {
          _pop: popExpr,
          _rel: {
            $add: [
              ...(actorBoostIds.length
                ? [{ $cond: [{ $in: ["$id", actorBoostIds] }, 150, 0] }]
                : []),
              {
                $cond: [
                  { $eq: [{ $toLower: { $ifNull: ["$title", ""] } }, lowered] },
                  1000,
                  0,
                ],
              },
              {
                $cond: [
                  { $eq: [{ $toLower: { $ifNull: ["$name", ""] } }, lowered] },
                  1000,
                  0,
                ],
              },
              {
                $cond: [
                  {
                    $regexMatch: {
                      input: { $toLower: { $ifNull: ["$title", ""] } },
                      regex: `^${safeLower}`,
                    },
                  },
                  300,
                  0,
                ],
              },
              {
                $cond: [
                  {
                    $regexMatch: {
                      input: { $toLower: { $ifNull: ["$name", ""] } },
                      regex: `^${safeLower}`,
                    },
                  },
                  300,
                  0,
                ],
              },
              {
                $cond: [
                  {
                    $regexMatch: {
                      input: { $toLower: { $ifNull: ["$title", ""] } },
                      regex: safeLower,
                    },
                  },
                  120,
                  0,
                ],
              },
              {
                $cond: [
                  {
                    $regexMatch: {
                      input: { $toLower: { $ifNull: ["$name", ""] } },
                      regex: safeLower,
                    },
                  },
                  120,
                  0,
                ],
              },
            ],
          },
        },
      },
      { $sort: { _rel: -1, _pop: -1, _id: -1 } },
      { $skip: skip },
      { $limit: limit },
      { $project: { _pop: 0, _rel: 0 } },
    ];

    const [total, docs] = await Promise.all([
      col.countDocuments(filter),
      col.aggregate(relevancePipeline).toArray(),
    ]);

    const totalPages = Math.max(1, Math.ceil(total / limit));

    return Response.json({
      page: clientPage,
      limit,
      total,
      totalPages,
      results: docs.map(mapContentDocToItem),
    });
  } catch (err) {
    console.error(err);
    return Response.json(
      { error: "Search failed", results: [], total: 0 },
      { status: 500 }
    );
  }
}
