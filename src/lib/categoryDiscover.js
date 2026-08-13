import {
  catalogAnimeIdMongoExpr,
  catalogExcludeAdultAnimeMongoClause,
  catalogKdramaClause,
  catalogTodayIsoUtc,
  catalogTvBrowseReleasedClause,
  releasedAnimeFirstAirClause,
} from "@/lib/catalogQuery";
import {
  catalogExcludeKdramaJunkMongoClause,
  catalogHasKdramaArtMongoClause,
} from "@/lib/kdramaCatalogPolicy.js";
import {
  catalogDisplayVoteAverage,
  catalogPopularityScore,
  mongoAnimeCatalogPopularityExpr,
  mongoCatalogDisplayVoteExpr,
  mongoMixedTvCatalogPopularityExpr,
  mongoTopRatedQualityMatch,
  mongoTopRatedVoteExpr,
  mongoTopRatedSortExpr,
} from "@/lib/catalogPopularity";
import {
  catalogDocReleaseDateString,
  runtimeSecondsFromDoc,
  tvEpisodeCountFromDoc,
  tvSeasonCountFromDoc,
  catalogOverviewFromDoc,
  usCertificationFromDoc,
} from "@/lib/mapContentDocToItem";
import { animeHeroBannerFromDoc, animePosterFromDoc } from "@/lib/animePoster";
import { enrichAnimeDocsWithTmdbBackdrops } from "@/lib/animeTmdbArt";
import { IMDB_GENRES, orderGenreRowsByPreference, genreNamesFromDoc } from "@/lib/imdbGenres";
import { getCatalogCategory } from "@/lib/catalogCategories";
import { mergeWithPreferenceFilter } from "@/lib/preferenceMatch";
import { hasUserPreferences } from "@/types/user";
import { dedupeCatalogEntries } from "@/lib/catalogRailDedupe.js";
import {
  catalogDocForSchedule,
  getCachedAnilistAiredEpisodes,
  mongoMatchFromAiringSchedules,
} from "@/lib/api/anilistAiringSchedule.js";

const TILE_POSTERS = 5;
const RAIL_LIMIT = 24;
const TRENDING_LIMIT = 16;
const FEATURED_SIZE = 2;

const AGG_OPTS = { allowDiskUse: true };

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
    overview: catalogOverviewFromDoc(doc),
    genres: genreNamesFromDoc(doc),
    certification: usCertificationFromDoc(doc),
    poster_path: useAnimeArt
      ? animePosterFromDoc(doc)
      : doc.poster_path ?? null,
    backdrop_path: useAnimeArt
      ? animeHeroBannerFromDoc(doc)
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
      catalogHasKdramaArtMongoClause,
      catalogExcludeKdramaJunkMongoClause(),
    ],
  };
}

async function fetchRail(col, baseFilter, { anime = false, sort = "popular", limit = RAIL_LIMIT, extraClause = null } = {}) {
  const filter = extraClause
    ? { $and: [baseFilter, extraClause] }
    : baseFilter;

  if (sort === "popular") {
    const popExpr = anime ? mongoAnimeCatalogPopularityExpr() : mongoMixedTvCatalogPopularityExpr();
    const rows = await col
      .aggregate(
        [
          { $match: filter },
          { $addFields: { _catalogPop: popExpr } },
          { $sort: { _catalogPop: -1, _id: -1 } },
          { $limit: limit },
          { $project: { _catalogPop: 0 } },
        ],
        AGG_OPTS
      )
      .toArray();
    return dedupeCatalogEntries(rows).map((doc) => mapTvRow(doc, { anime }));
  }

  if (sort === "top_rated") {
    const voteExpr = mongoTopRatedVoteExpr({ anime });
    const rows = await col
      .aggregate(
        [
          { $match: filter },
          {
            $addFields: {
              _topRatedVote: voteExpr,
              _topRatedSort: mongoTopRatedSortExpr(voteExpr),
            },
          },
          { $match: mongoTopRatedQualityMatch({ anime }) },
          {
            $sort: anime
              ? { _topRatedVote: -1, _id: -1 }
              : { _topRatedSort: -1, vote_count: -1, _id: -1 },
          },
          { $limit: limit },
          { $project: { _topRatedVote: 0, _topRatedSort: 0 } },
        ],
        AGG_OPTS
      )
      .toArray();
    return dedupeCatalogEntries(rows).map((doc) => mapTvRow(doc, { anime }));
  }

  const rows = await col
    .find(filter)
    .sort({ first_air_date: -1, _id: -1 })
    .limit(limit)
    .toArray();
  return dedupeCatalogEntries(rows).map((doc) => mapTvRow(doc, { anime }));
}

function isoDaysAgo(days) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

/** Prefer higher-rated titles; break ties by most recent air date. */
function sortNewEpisodeRows(rows) {
  return [...rows].sort((a, b) => {
    const voteA = Number(a.vote_average) || 0;
    const voteB = Number(b.vote_average) || 0;
    if (voteB !== voteA) return voteB - voteA;

    const dateA = a.last_air_date ?? "";
    const dateB = b.last_air_date ?? "";
    if (dateB !== dateA) return dateB.localeCompare(dateA);

    return String(a.id ?? "").localeCompare(String(b.id ?? ""));
  });
}

async function fetchNewEpisodesFromMongo(
  col,
  baseFilter,
  { anime = false, limit = RAIL_LIMIT, lookbackDays = 7 } = {}
) {
  const cutoff = isoDaysAgo(lookbackDays);
  const voteExpr = mongoCatalogDisplayVoteExpr({ anime });

  const rows = await col
    .aggregate(
      [
        { $match: { $and: [baseFilter, { last_air_date: { $gte: cutoff } }] } },
        { $addFields: { _newEpVote: voteExpr } },
        { $sort: { _newEpVote: -1, last_air_date: -1, _id: -1 } },
        { $limit: limit },
        { $project: { _newEpVote: 0 } },
      ],
      AGG_OPTS
    )
    .toArray();

  return sortNewEpisodeRows(
    dedupeCatalogEntries(rows).map((doc) => mapTvRow(doc, { anime }))
  );
}

/** Live AniList schedule → catalog rows with aired episode numbers. */
async function fetchAnimeNewEpisodesFromAnilist(
  col,
  baseFilter,
  { limit = RAIL_LIMIT, lookbackDays = 7 } = {}
) {
  const schedules = await getCachedAnilistAiredEpisodes(lookbackDays, 50);
  if (schedules.length === 0) return [];

  const matchOr = mongoMatchFromAiringSchedules(schedules);
  if (!matchOr) return [];

  const docs = await col.find({ $and: [baseFilter, matchOr] }).toArray();
  if (docs.length === 0) return [];

  /** @type {ReturnType<typeof mapTvRow>[]} */
  const out = [];
  const usedIds = new Set();

  for (const schedule of schedules) {
    const doc = docs.find((row) => catalogDocForSchedule(row, schedule));
    if (!doc) continue;

    const idKey = String(doc.id ?? "");
    if (!idKey || usedIds.has(idKey)) continue;
    usedIds.add(idKey);

    const row = mapTvRow(doc, { anime: true });
    const ep = Number(schedule.episode);
    if (Number.isFinite(ep) && ep > 0) {
      row.number_of_episodes = ep;
    }
    row.last_air_date = new Date(schedule.airingAt * 1000).toISOString().slice(0, 10);
    out.push(row);
  }

  return sortNewEpisodeRows(out).slice(0, limit);
}

async function fetchNewEpisodesRail(
  col,
  baseFilter,
  { anime = false, limit = RAIL_LIMIT, lookbackDays = 7 } = {}
) {
  if (anime) {
    const [mongoRows, anilistRows] = await Promise.all([
      fetchNewEpisodesFromMongo(col, baseFilter, {
        anime: true,
        limit,
        lookbackDays,
      }),
      fetchAnimeNewEpisodesFromAnilist(col, baseFilter, {
        limit,
        lookbackDays,
      }).catch(() => []),
    ]);
    if (anilistRows.length > 0) return anilistRows;
    return mongoRows;
  }

  return fetchNewEpisodesFromMongo(col, baseFilter, {
    anime: false,
    limit,
    lookbackDays,
  });
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

async function fetchPopularDocs(col, baseFilter, { anime = false, limit = RAIL_LIMIT } = {}) {
  const popExpr = anime ? mongoAnimeCatalogPopularityExpr() : mongoMixedTvCatalogPopularityExpr();
  return col
    .aggregate(
      [
        { $match: baseFilter },
        { $addFields: { _catalogPop: popExpr } },
        { $sort: { _catalogPop: -1, _id: -1 } },
        { $limit: limit },
        { $project: { _catalogPop: 0 } },
      ],
      AGG_OPTS
    )
    .toArray();
}

function resolveCategoryBaseFilter(slug, preferences = null) {
  const category = getCatalogCategory(slug);
  if (!category) return null;

  const kind = category.slug === "anime" ? "anime" : "kdrama";
  let baseFilter = categoryReleasedFilter(kind);

  if (hasUserPreferences(preferences)) {
    baseFilter = mergeWithPreferenceFilter(baseFilter, preferences, {
      skipGenres: true,
      skipCategories: true,
      skipLanguages: true,
    });
  }

  return { category, kind, anime: kind === "anime", baseFilter };
}

/**
 * Fast hub payload — one popularity aggregation for spotlight + popular rail.
 * @param {import("mongodb").Collection} col
 * @param {string} slug
 */
export async function fetchCategoryHero(col, slug, preferences = null) {
  const resolved = resolveCategoryBaseFilter(slug, preferences);
  if (!resolved) return null;

  const { anime, baseFilter } = resolved;
  const popularDocs = await fetchPopularDocs(col, baseFilter, { anime, limit: RAIL_LIMIT });
  if (anime) {
    await enrichAnimeDocsWithTmdbBackdrops(popularDocs.slice(0, TRENDING_LIMIT));
  }
  const featuredDocs = popularDocs.slice(0, FEATURED_SIZE);
  const featured = featuredDocs.map((doc) => mapTvRow(doc, { anime }));
  const popular = dedupeCatalogEntries(popularDocs).map((doc) => mapTvRow(doc, { anime }));
  const trending = dedupeCatalogEntries(popularDocs)
    .slice(0, TRENDING_LIMIT)
    .map((doc) => mapTvRow(doc, { anime }));

  return {
    featured,
    trending,
    popular: dedupeFeatured(popular, featured),
  };
}

/**
 * Below-the-fold hub rails — top rated, new episodes, genre tiles.
 * @param {import("mongodb").Collection} col
 * @param {string} slug
 */
export async function fetchCategoryTopRated(col, slug, preferences = null) {
  const resolved = resolveCategoryBaseFilter(slug, preferences);
  if (!resolved) return [];

  const { anime, baseFilter } = resolved;
  return fetchRail(col, baseFilter, { anime, sort: "top_rated" });
}

export async function fetchCategoryNewEpisodes(col, slug, preferences = null) {
  const resolved = resolveCategoryBaseFilter(slug, preferences);
  if (!resolved) return [];

  const { anime, baseFilter } = resolved;
  return fetchNewEpisodesRail(col, baseFilter, { anime });
}

export async function fetchCategoryGenreTiles(col, slug, preferences = null) {
  const resolved = resolveCategoryBaseFilter(slug, preferences);
  if (!resolved) return [];

  const genres = await rankCategoryGenres(col, resolved.baseFilter);
  return hasUserPreferences(preferences)
    ? orderGenreRowsByPreference(genres, preferences.genres)
    : genres;
}

export async function fetchCategoryRails(col, slug, preferences = null) {
  const resolved = resolveCategoryBaseFilter(slug, preferences);
  if (!resolved) return null;

  const [topRated, newEpisodes, genres] = await Promise.all([
    fetchCategoryTopRated(col, slug, preferences),
    fetchCategoryNewEpisodes(col, slug, preferences),
    fetchCategoryGenreTiles(col, slug, preferences),
  ]);

  return {
    topRated,
    newEpisodes,
    genres,
  };
}

/**
 * @param {import("mongodb").Collection} col
 * @param {string} slug
 * @param {import('@/types/user').UserPreferences | null} [preferences]
 */
export async function fetchCategoryDiscover(col, slug, preferences = null) {
  const [hero, rails] = await Promise.all([
    fetchCategoryHero(col, slug, preferences),
    fetchCategoryRails(col, slug, preferences),
  ]);
  if (!hero || !rails) return null;

  return {
    ...hero,
    ...rails,
    newEpisodes: dedupeFeatured(rails.newEpisodes, hero.trending),
  };
}
