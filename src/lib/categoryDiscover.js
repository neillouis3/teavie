import {
  catalogAnimeIdMongoExpr,
  catalogExcludeAdultAnimeMongoClause,
  catalogKdramaClause,
  catalogTodayIsoUtc,
  catalogTvBrowseReleasedClause,
  releasedAnimeFirstAirClause,
} from "@/lib/catalogQuery";
import {
  catalogDisplayVoteAverage,
  catalogPopularityScore,
  mongoAnimeCatalogPopularityExpr,
  mongoCatalogDisplayVoteExpr,
  mongoMixedTvCatalogPopularityExpr,
  mongoTopRatedQualityMatch,
} from "@/lib/catalogPopularity";
import {
  catalogDocReleaseDateString,
  runtimeSecondsFromDoc,
  tvEpisodeCountFromDoc,
  tvSeasonCountFromDoc,
} from "@/lib/mapContentDocToItem";
import { animeBackdropFromDoc, animePosterFromDoc } from "@/lib/animePoster";
import { enrichAnimeDocsWithTmdbBackdrops } from "@/lib/animeTmdbArt";
import { IMDB_GENRES, orderGenreRowsByPreference } from "@/lib/imdbGenres";
import { getCatalogCategory } from "@/lib/catalogCategories";
import { mergeWithPreferenceFilter } from "@/lib/preferenceMatch";
import { hasUserPreferences } from "@/types/user";

const TILE_POSTERS = 5;
const RAIL_LIMIT = 24;
const TRENDING_LIMIT = 16;
const FEATURED_SIZE = 2;
const FEATURED_POOL = 48;

const HAS_POSTER_OR_BACKDROP = {
  $or: [
    { backdrop_path: { $type: "string", $regex: /\S/ } },
    { poster_path: { $type: "string", $regex: /\S/ } },
  ],
};

const HAS_IMDB_ID = { imdb_id: { $type: "string", $regex: /^tt/i } };

function popularityExpr(anime = false) {
  const popDouble = {
    $convert: { input: "$popularity", to: "double", onError: 0, onNull: 0 },
  };
  if (anime) {
    return { $divide: [popDouble, 1000] };
  }
  return popDouble;
}

function mapTvRow(doc, { anime = false } = {}) {
  const release_date = catalogDocReleaseDateString(doc);
  const useAnimeArt =
    anime ||
    doc?.is_anime === true ||
    String(doc?.id ?? "").startsWith("anime_");
  return {
    id: doc.id.toString(),
    title: doc.title ?? doc.name,
    release_date,
    first_air_date: doc.first_air_date ?? release_date ?? undefined,
    last_air_date:
      typeof doc.last_air_date === "string" ? doc.last_air_date.slice(0, 10) : undefined,
    runtimeSeconds: runtimeSecondsFromDoc(doc),
    season_amount: tvSeasonCountFromDoc(doc),
    number_of_episodes: tvEpisodeCountFromDoc(doc),
    popularity: catalogPopularityScore(doc, { anime }),
    vote_average: catalogDisplayVoteAverage(doc),
    poster_path: useAnimeArt
      ? animePosterFromDoc(doc)
      : doc.poster_path ?? null,
    backdrop_path: useAnimeArt
      ? animeBackdropFromDoc(doc)
      : doc.backdrop_path ?? null,
    type: "tv",
    is_anime: useAnimeArt || undefined,
  };
}

/** @param {"anime"|"kdrama"} kind */
function categoryReleasedFilter(kind) {
  const todayIso = catalogTodayIsoUtc();
  if (kind === "anime") {
    return {
      $and: [
        catalogAnimeIdMongoExpr(),
        catalogExcludeAdultAnimeMongoClause(),
        releasedAnimeFirstAirClause(todayIso),
      ],
    };
  }
  return {
    $and: [
      catalogKdramaClause(),
      catalogTvBrowseReleasedClause("first_air_date", todayIso),
    ],
  };
}

/** ISO date `years` ago (UTC), for featured recency filters. */
function catalogIsoYearsAgo(years) {
  const d = new Date();
  d.setUTCFullYear(d.getUTCFullYear() - years);
  return d.toISOString().slice(0, 10);
}

function recentFirstAirClause(years) {
  return {
    first_air_date: {
      $type: "string",
      $regex: /^\d{4}-\d{2}-\d{2}/,
      $gte: catalogIsoYearsAgo(years),
    },
  };
}

const HAS_ANIME_ART = {
  $or: [
    { backdrop_path: { $type: "string", $regex: /\S/ } },
    { poster_path: { $type: "string", $regex: /\S/ } },
    { "anilist.coverImage.extraLarge": { $type: "string", $regex: /\S/ } },
    { "anilist.coverImage.large": { $type: "string", $regex: /\S/ } },
    { "anilist.bannerImage": { $type: "string", $regex: /\S/ } },
  ],
};

async function pickFeatured(col, filter, { anime = false } = {}) {
  // Anime used a raw `popularity / 1000` sort that favored all-time MAL classics.
  const popExpr = anime
    ? mongoAnimeCatalogPopularityExpr()
    : popularityExpr(false);
  const voteExpr = mongoCatalogDisplayVoteExpr({ anime });

  const baseStages = [
    { $match: filter },
    {
      $addFields: {
        _pop: popExpr,
        _vote: voteExpr,
      },
    },
  ];

  async function sample(extraMatch, poolSize = FEATURED_POOL) {
    return col
      .aggregate([
        ...baseStages,
        { $match: extraMatch },
        { $sort: { _pop: -1, _id: -1 } },
        { $limit: poolSize },
        { $sample: { size: FEATURED_SIZE } },
        { $project: { _pop: 0, _vote: 0 } },
      ])
      .toArray();
  }

  // Anime hub featured: prefer currently relevant titles (last ~2–4 years),
  // not all-time classics. Skip IMDb-id gate — many anime_* rows lack it.
  const tiers = anime
    ? [
        {
          $and: [
            HAS_ANIME_ART,
            recentFirstAirClause(2),
            { _vote: { $gte: 6 } },
          ],
        },
        { $and: [HAS_ANIME_ART, recentFirstAirClause(2)] },
        { $and: [HAS_ANIME_ART, recentFirstAirClause(4)] },
        HAS_ANIME_ART,
        {},
      ]
    : [
        { $and: [HAS_POSTER_OR_BACKDROP, HAS_IMDB_ID, { _vote: { $gte: 6 } }] },
        { $and: [HAS_POSTER_OR_BACKDROP, HAS_IMDB_ID] },
        HAS_POSTER_OR_BACKDROP,
        {},
      ];

  const tierResults = await Promise.all(tiers.map((tier) => sample(tier)));
  for (const docs of tierResults) {
    if (docs.length >= FEATURED_SIZE) return docs.slice(0, FEATURED_SIZE);
  }
  return tierResults.find((docs) => docs.length > 0) ?? [];
}

async function fetchRail(col, baseFilter, { anime = false, sort = "popular", limit = RAIL_LIMIT, extraClause = null } = {}) {
  const filter = extraClause
    ? { $and: [baseFilter, extraClause] }
    : baseFilter;

  if (sort === "popular") {
    const popExpr = anime ? mongoAnimeCatalogPopularityExpr() : mongoMixedTvCatalogPopularityExpr();
    const rows = await col
      .aggregate([
        { $match: filter },
        { $addFields: { _catalogPop: popExpr } },
        { $sort: { _catalogPop: -1, _id: -1 } },
        { $limit: limit },
        { $project: { _catalogPop: 0 } },
      ])
      .toArray();
    return rows.map((doc) => mapTvRow(doc, { anime }));
  }

  if (sort === "top_rated") {
    const voteExpr = mongoCatalogDisplayVoteExpr({ anime });
    const rows = await col
      .aggregate([
        { $match: filter },
        { $addFields: { _catalogVote: voteExpr } },
        { $match: mongoTopRatedQualityMatch({ anime }) },
        {
          $sort: anime
            ? { _catalogVote: -1, _id: -1 }
            : { _catalogVote: -1, vote_count: -1, _id: -1 },
        },
        { $limit: limit },
        { $project: { _catalogVote: 0 } },
      ])
      .toArray();
    return rows.map((doc) => mapTvRow(doc, { anime }));
  }

  const rows = await col
    .find(filter)
    .sort({ first_air_date: -1, _id: -1 })
    .limit(limit)
    .toArray();
  return rows.map((doc) => mapTvRow(doc, { anime }));
}

function isoDaysAgo(days) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

async function fetchNewEpisodesRail(
  col,
  baseFilter,
  { anime = false, limit = RAIL_LIMIT } = {}
) {
  const popExpr = anime
    ? mongoAnimeCatalogPopularityExpr()
    : mongoMixedTvCatalogPopularityExpr();

  const airingFilter = anime
    ? {
        $or: [{ status: "Currently Airing" }, { "anilist.status": "RELEASING" }],
      }
    : {
        status: { $in: ["Returning Series", "In Production"] },
        last_air_date: {
          $type: "string",
          $regex: /^\d{4}-\d{2}-\d{2}/,
          $gte: isoDaysAgo(28),
        },
      };

  async function loadRows(matchExtra, sort) {
    return col
      .aggregate([
        { $match: { $and: [baseFilter, matchExtra] } },
        { $addFields: { _catalogPop: popExpr } },
        { $sort: sort },
        { $limit: limit },
        { $project: { _catalogPop: 0 } },
      ])
      .toArray();
  }

  let rows = await loadRows(
    airingFilter,
    anime
      ? { _catalogPop: -1, _id: -1 }
      : { last_air_date: -1, _catalogPop: -1, _id: -1 }
  );

  if (!anime && rows.length < Math.min(8, limit)) {
    const fallback = await loadRows(
      {
        status: "Returning Series",
        last_air_date: { $type: "string", $regex: /^\d{4}-\d{2}-\d{2}/ },
      },
      { last_air_date: -1, _catalogPop: -1, _id: -1 }
    );
    const seen = new Set(rows.map((doc) => String(doc.id)));
    for (const doc of fallback) {
      const key = String(doc.id);
      if (seen.has(key)) continue;
      seen.add(key);
      rows.push(doc);
      if (rows.length >= limit) break;
    }
  }

  return rows.map((doc) => mapTvRow(doc, { anime }));
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
  ];
}

async function rankCategoryGenres(col, baseFilter) {
  const labels = IMDB_GENRES.map((g) => g.label);
  let rows;
  try {
    rows = await col
      .aggregate(buildGenrePipeline(baseFilter, labels, true))
      .toArray();
  } catch {
    rows = await col
      .aggregate(buildGenrePipeline(baseFilter, labels, false))
      .toArray();
  }

  const slugByLabel = new Map(IMDB_GENRES.map((g) => [g.label, g.slug]));

  return assignUniquePosters(
    rows
      .filter((r) => labels.includes(r._id) && r.count > 0)
      .map((r) => ({
        slug: slugByLabel.get(r._id) ?? String(r._id).toLowerCase().replace(/\s+/g, "-"),
        name: r._id,
        count: r.count,
        posters: (r.posters || [])
          .filter((p) => typeof p === "string" && p.trim().length > 0)
          .slice(0, TILE_POSTERS),
      }))
  );
}

/** Pick posters per genre without reusing paths from earlier tiles. */
function assignUniquePosters(rows) {
  const used = new Set();
  return rows.map((row) => {
    const picked = [];
    for (const path of row.posters ?? []) {
      if (used.has(path)) continue;
      picked.push(path);
      used.add(path);
      if (picked.length >= 3) break;
    }
    return { ...row, posters: picked };
  });
}

function dedupeFeatured(rail, featured) {
  if (!featured.length) return rail;
  const keys = new Set(featured.map((item) => `${item.type ?? "tv"}-${item.id}`));
  return rail.filter((item) => !keys.has(`${item.type ?? "tv"}-${item.id}`));
}

/**
 * @param {import("mongodb").Collection} col
 * @param {string} slug
 */
export async function fetchCategoryGenres(col, slug) {
  const category = getCatalogCategory(slug);
  if (!category) return [];

  const kind = category.slug === "anime" ? "anime" : "kdrama";
  const baseFilter = categoryReleasedFilter(kind);
  return rankCategoryGenres(col, baseFilter);
}

function dedupeDocsByCatalogId(docs) {
  const seen = new Set();
  const out = [];
  for (const doc of docs) {
    const key = String(doc?.id ?? "");
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(doc);
  }
  return out;
}

async function fetchPopularDocs(col, baseFilter, { anime = false, limit = RAIL_LIMIT } = {}) {
  const popExpr = anime ? mongoAnimeCatalogPopularityExpr() : mongoMixedTvCatalogPopularityExpr();
  return col
    .aggregate([
      { $match: baseFilter },
      { $addFields: { _catalogPop: popExpr } },
      { $sort: { _catalogPop: -1, _id: -1 } },
      { $limit: limit },
      { $project: { _catalogPop: 0 } },
    ])
    .toArray();
}

/**
 * @param {import("mongodb").Collection} col
 * @param {string} slug
 * @param {import('@/types/user').UserPreferences | null} [preferences]
 */
export async function fetchCategoryDiscover(col, slug, preferences = null) {
  const category = getCatalogCategory(slug);
  if (!category) return null;

  const kind = category.slug === "anime" ? "anime" : "kdrama";
  const anime = kind === "anime";
  let baseFilter = categoryReleasedFilter(kind);

  if (hasUserPreferences(preferences)) {
    baseFilter = mergeWithPreferenceFilter(baseFilter, preferences, {
      skipGenres: true,
      skipCategories: true,
      skipLanguages: true,
    });
  }

  const [featuredDocs, popularDocs, topRated, newEpisodes, genres] = await Promise.all([
    pickFeatured(col, baseFilter, { anime }),
    fetchPopularDocs(col, baseFilter, { anime, limit: RAIL_LIMIT }),
    fetchRail(col, baseFilter, { anime, sort: "top_rated" }),
    fetchNewEpisodesRail(col, baseFilter, { anime }),
    rankCategoryGenres(col, baseFilter),
  ]);

  if (anime) {
    const heroDocs = dedupeDocsByCatalogId([
      ...featuredDocs,
      ...popularDocs.slice(0, TRENDING_LIMIT),
    ]);
    await enrichAnimeDocsWithTmdbBackdrops(heroDocs);
  }

  const featured = featuredDocs.map((doc) => mapTvRow(doc, { anime }));
  const popular = popularDocs.map((doc) => mapTvRow(doc, { anime }));
  const trending = popularDocs
    .slice(0, TRENDING_LIMIT)
    .map((doc) => mapTvRow(doc, { anime }));

  return {
    featured,
    trending,
    popular: dedupeFeatured(popular, featured),
    topRated,
    newEpisodes: dedupeFeatured(newEpisodes, featured),
    genres: hasUserPreferences(preferences)
      ? orderGenreRowsByPreference(genres, preferences.genres)
      : genres,
  };
}
