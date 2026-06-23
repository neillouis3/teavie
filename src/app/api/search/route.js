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
  catalogExcludeJpAnimationNumericTvMongoClause,
  catalogImdbGenreMatchClause,
  catalogKdramaClause,
  catalogMoviePolicyClause,
  catalogTodayIsoUtc,
  escapeRegex,
  releasedAnimeFirstAirClause,
  releasedCatalogClause,
} from "@/lib/catalogQuery";
import { detectGenres, fetchActorCreditIds } from "@/lib/catalogSearch";
import { imdbGenreMatchConditions } from "@/lib/imdbGenres";
import { tmdbBearerToken } from "@/lib/tmdbAuth";
import { mapContentDocToItem } from "@/lib/mapContentDocToItem";

const DEFAULT_LIMIT = 28;

const notAnimeTv = {
  $nor: [{ is_anime: true }, { tags: "anime" }],
};

function yearRangeClause(dateField, yearMin, yearMax) {
  const yMinOk = yearMin && /^\d{4}$/.test(yearMin);
  const yMaxOk = yearMax && /^\d{4}$/.test(yearMax);
  if (!yMinOk && !yMaxOk) return null;
  /** @type {Record<string, string>} */
  const range = {};
  if (yMinOk) range.$gte = `${yearMin}-01-01`;
  if (yMaxOk) range.$lte = `${yearMax}-12-31`;
  return { [dateField]: range };
}

/** @param {Record<string, unknown>[]} andParts */
function pushClauses(andParts, clauses) {
  for (const c of clauses) {
    if (c) andParts.push(c);
  }
}

function buildSortFields(sortBy) {
  switch (sortBy) {
    case "title_desc":
      return { _sortTitle: -1, _id: -1 };
    case "release_year":
      return { _sortDate: -1, _id: -1 };
    case "release_year_asc":
      return { _sortDate: 1, _id: -1 };
    case "popularity":
      return { _pop: -1, _id: -1 };
    case "runtime_desc":
      return { runtimeSeconds: -1, _id: -1 };
    case "runtime_asc":
      return { runtimeSeconds: 1, _id: -1 };
    case "title":
      return { _sortTitle: 1, _id: -1 };
    default:
      return null;
  }
}

/** Title relevance boosts for catalog + anime alias fields. */
function titleRelevanceScoreAddends(lowered, safeLower) {
  const lowerField = (path) => ({ $toLower: { $ifNull: [path, ""] } });
  const fields = [
    "$title",
    "$name",
    "$anilist.title.english",
    "$anilist.title.romaji",
    "$anilist.title.native",
  ];
  /** @type {Record<string, unknown>[]} */
  const out = [];
  for (const path of fields) {
    const field = lowerField(path);
    out.push(
      { $cond: [{ $eq: [field, lowered] }, 1000, 0] },
      {
        $cond: [
          { $regexMatch: { input: field, regex: `^${safeLower}` } },
          300,
          0,
        ],
      },
      { $cond: [{ $regexMatch: { input: field, regex: safeLower } }, 120, 0] }
    );
  }
  out.push({
    $cond: [
      {
        $gt: [
          {
            $size: {
              $filter: {
                input: { $ifNull: ["$title_aliases", []] },
                as: "alias",
                cond: {
                  $regexMatch: {
                    input: { $toLower: "$$alias" },
                    regex: safeLower,
                  },
                },
              },
            },
          },
          0,
        ],
      },
      120,
      0,
    ],
  });
  return out;
}

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const q = (searchParams.get("q") || "").trim();
    const typeFilter = searchParams.get("type")?.trim() || "all";
    const genreParam = searchParams.get("genre")?.trim() || "";
    const yearMin = searchParams.get("year_min")?.trim() || "";
    const yearMax = searchParams.get("year_max")?.trim() || "";
    const sortBy = searchParams.get("sort_by")?.trim() || "relevance";
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

    // --- Genre conditions (canonical `imdb_genres` on catalog docs) ---
    const { imdbLabels, kdrama } = detectGenres(q);
    /** @type {Record<string, unknown>[]} */
    const genreConds = [];
    for (const label of imdbLabels) {
      genreConds.push(imdbGenreMatchConditions(label));
    }
    /** K-Drama is TV-only; keep off the movie branch. */
    const tvGenreConds = [...genreConds];
    if (kdrama) {
      tvGenreConds.push(catalogKdramaClause());
    }
    const genreBoostLabels = [...imdbLabels];

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

    const genreFilterClause = genreParam
      ? catalogImdbGenreMatchClause(genreParam)
      : null;
    const movieYearClause = yearRangeClause("release_date", yearMin, yearMax);
    const tvYearClause = yearRangeClause("first_air_date", yearMin, yearMax);

    const todayIso = catalogTodayIsoUtc();
    const includeUnreleased = searchParams.get("include_unreleased") === "1";

    /** @param {Record<string, unknown>[]} andParts */
    function finalizeBranch(andParts) {
      pushClauses(andParts, [genreFilterClause]);
      return andParts.length === 1 ? andParts[0] : { $and: andParts };
    }

    const movieBranch = finalizeBranch([
      { type: "movie" },
      { $or: [...textConds, ...genreConds, ...actorMovieCond] },
      ...(includeUnreleased
        ? []
        : [releasedCatalogClause("release_date", todayIso)]),
      catalogMoviePolicyClause(),
      movieYearClause,
    ].filter(Boolean));

    const tvAnimeBranch = finalizeBranch([
      { type: "tv" },
      {
        $or: [
          ...animeTitleSearchConditions(safe),
          { overview: { $regex: safe, $options: "i" } },
          { tagline: { $regex: safe, $options: "i" } },
          ...genreConds,
        ],
      },
      catalogAnimeIdMongoExpr(),
      ...(includeUnreleased ? [] : [releasedAnimeFirstAirClause(todayIso)]),
      tvYearClause,
    ].filter(Boolean));

    const tvLiveBranch = finalizeBranch([
      { type: "tv" },
      { $or: [...textConds, ...tvGenreConds, ...actorTvCond] },
      notAnimeTv,
      catalogExcludeJpAnimationNumericTvMongoClause(),
      ...(includeUnreleased
        ? []
        : [releasedCatalogClause("first_air_date", todayIso)]),
      tvYearClause,
    ].filter(Boolean));

    const kdramaBranch = finalizeBranch([
      { type: "tv" },
      catalogKdramaClause(),
      { $or: [...textConds, ...tvGenreConds, ...actorTvCond] },
      ...(includeUnreleased
        ? []
        : [releasedCatalogClause("first_air_date", todayIso)]),
      tvYearClause,
    ].filter(Boolean));

    /** @type {Record<string, unknown>[]} */
    const branches = [];
    if (typeFilter === "movie") {
      branches.push(movieBranch);
    } else if (typeFilter === "anime") {
      branches.push(tvAnimeBranch);
    } else if (typeFilter === "tv") {
      branches.push(tvLiveBranch);
    } else if (typeFilter === "kdrama") {
      branches.push(kdramaBranch);
    } else {
      branches.push(movieBranch, tvAnimeBranch, tvLiveBranch);
    }

    const filter =
      branches.length === 1 ? branches[0] : { $or: branches };

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
    const sortFields = buildSortFields(sortBy);
    const useRelevance = !sortFields;

    const sortedPipeline = sortFields
      ? [
          { $match: filter },
          {
            $addFields: {
              _pop: popExpr,
              _sortTitle: {
                $toLower: { $ifNull: ["$name", { $ifNull: ["$title", ""] }] },
              },
              _sortDate: { $ifNull: ["$release_date", "$first_air_date"] },
            },
          },
          { $sort: sortFields },
          { $skip: skip },
          { $limit: limit },
          { $project: { _pop: 0, _sortTitle: 0, _sortDate: 0 } },
        ]
      : null;

    const relevancePipeline = [
      { $match: filter },
      {
        $addFields: {
          _pop: popExpr,
          _rel: {
            $add: [
              ...(genreBoostLabels.length
                ? [
                    {
                      $cond: [
                        {
                          $gt: [
                            {
                              $size: {
                                $setIntersection: [
                                  { $ifNull: ["$imdb_genres", []] },
                                  genreBoostLabels,
                                ],
                              },
                            },
                            0,
                          ],
                        },
                        400,
                        0,
                      ],
                    },
                  ]
                : []),
              ...(actorBoostIds.length
                ? [
                    {
                      $cond: [
                        {
                          $in: [
                            { $toString: "$id" },
                            actorBoostIds.map(String),
                          ],
                        },
                        150,
                        0,
                      ],
                    },
                  ]
                : []),
              ...titleRelevanceScoreAddends(lowered, safeLower),
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
      col
        .aggregate(useRelevance ? relevancePipeline : sortedPipeline)
        .toArray(),
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
