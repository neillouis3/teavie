/**
 * Personalized catalog rows from user onboarding preferences.
 */

import clientPromise from "@/lib/mongo";
import {
  catalogMoviePolicyClause,
  catalogTodayIsoUtc,
  releasedCatalogClause,
} from "@/lib/catalogQuery";
import {
  buildPreferenceMatch,
  docMatchesPreferences,
  selectedGenreLabels,
  selectedLanguageCodes,
  sortDocsByPreferenceRank,
} from "@/lib/preferenceMatch";
import { mapContentDocToItem } from "@/lib/mapContentDocToItem";
import { isBlockedMovieTmdbId } from "@/lib/tmdbMovieContentPolicy";
import { CATALOG_POPULAR_MIN_VOTE_AVERAGE } from "@/lib/catalogPopularity";

const DEFAULT_LIMIT = 50;

const LIST_PROJECTION = {
  id: 1,
  tmdb_id: 1,
  type: 1,
  title: 1,
  name: 1,
  release_date: 1,
  first_air_date: 1,
  poster_path: 1,
  backdrop_path: 1,
  overview: 1,
  runtimeSeconds: 1,
  runtime: 1,
  season_amount: 1,
  number_of_seasons: 1,
  number_of_episodes: 1,
  vote_average: 1,
  imdb_genres: 1,
  omdb: 1,
  original_language: 1,
  origin_country: 1,
  production_countries: 1,
  is_anime: 1,
  anilist: 1,
  mal_id: 1,
};

function toDateString(date) {
  return date.toISOString().split("T")[0];
}

function mapDocsToItems(docs, preferences) {
  return sortDocsByPreferenceRank(
    docs.filter((doc) => docMatchesPreferences(doc, preferences)),
    preferences
  )
    .map((doc) => mapContentDocToItem(doc))
    .filter((item) => {
      if (item.type === "movie" && isBlockedMovieTmdbId(String(item.id))) {
        return false;
      }
      return true;
    });
}

function baseCatalogMatch(match, todayIso) {
  return {
    $and: [
      match,
      catalogMoviePolicyClause(),
      {
        $or: [
          releasedCatalogClause("release_date", todayIso),
          releasedCatalogClause("first_air_date", todayIso),
        ],
      },
      {
        $or: [
          { poster_path: { $type: "string", $regex: /\S/ } },
          { backdrop_path: { $type: "string", $regex: /\S/ } },
        ],
      },
    ],
  };
}

function buildPersonalizedFindFilter(match, todayIso, opts = {}) {
  /** @type {Record<string, unknown>[]} */
  const clauses = [baseCatalogMatch(match, todayIso)];
  if (opts.minVoteAverage != null) {
    clauses.push({ vote_average: { $gte: opts.minVoteAverage } });
  }
  return { $and: clauses };
}

async function queryPersonalizedCatalog(preferences, opts = {}) {
  const match = buildPreferenceMatch(preferences, { type: opts.type });
  if (!match) return [];

  const limit = Math.min(50, Math.max(1, opts.limit ?? DEFAULT_LIMIT));
  const excludeMovieIds = new Set(
    (Array.isArray(opts.excludeMovieIds) ? opts.excludeMovieIds : [])
      .map((id) => String(id ?? "").trim())
      .filter(Boolean)
  );
  const hasStrictPrefs =
    selectedGenreLabels(preferences).length > 0 ||
    selectedLanguageCodes(preferences).length > 0;
  const fetchPad = excludeMovieIds.size > 0 ? Math.min(48, excludeMovieIds.size) : 0;
  const fetchLimit = hasStrictPrefs
    ? Math.min(192, limit * 4 + fetchPad)
    : Math.min(96, limit + fetchPad);
  const todayIso = catalogTodayIsoUtc();

  const client = await clientPromise;
  const col = client.db("teavie").collection("content");
  const filter = buildPersonalizedFindFilter(match, todayIso, opts);

  const docs = await col
    .find(filter)
    .sort({ popularity: -1, _id: -1 })
    .limit(fetchLimit)
    .project(LIST_PROJECTION)
    .toArray();

  return mapDocsToItems(docs, preferences)
    .filter(
      (item) => !(item.type === "movie" && excludeMovieIds.has(String(item.id)))
    )
    .slice(0, limit);
}

async function queryPersonalizedNew(preferences, limit = 20) {
  const match = buildPreferenceMatch(preferences);
  if (!match) return [];

  const now = new Date();
  const past = new Date(now);
  past.setDate(past.getDate() - 30);
  const startDate = toDateString(past);
  const endDate = toDateString(now);

  const client = await clientPromise;
  const col = client.db("teavie").collection("content");

  const docs = await col
    .find({
      $and: [
        match,
        catalogMoviePolicyClause(),
        {
          $or: [
            {
              type: "movie",
              release_date: { $gte: startDate, $lte: endDate },
            },
            {
              type: "tv",
              first_air_date: { $gte: startDate, $lte: endDate },
            },
          ],
        },
      ],
    })
    .sort({ popularity: -1, release_date: -1, first_air_date: -1, _id: -1 })
    .limit(limit)
    .project(LIST_PROJECTION)
    .toArray();

  return mapDocsToItems(docs, preferences);
}

async function queryPersonalizedUpcoming(preferences, limit = 20) {
  const match = buildPreferenceMatch(preferences);
  if (!match) return [];

  const now = new Date();
  const ahead = new Date(now);
  ahead.setMonth(ahead.getMonth() + 1);
  const startDate = toDateString(now);
  const endDate = toDateString(ahead);

  const client = await clientPromise;
  const col = client.db("teavie").collection("content");

  const docs = await col
    .find({
      $and: [
        match,
        catalogMoviePolicyClause(),
        { type: "movie", release_date: { $gte: startDate, $lte: endDate } },
      ],
    })
    .sort({ popularity: -1, release_date: 1, _id: -1 })
    .limit(limit)
    .project(LIST_PROJECTION)
    .toArray();

  return mapDocsToItems(docs, preferences);
}

/**
 * @param {import('@/types/user').UserPreferences | null | undefined} preferences
 * @param {{ limit?: number; type?: 'movie' | 'tv'; excludeMovieIds?: string[] }} [opts]
 */
export async function loadPersonalizedCatalog(preferences, opts = {}) {
  const items = await queryPersonalizedCatalog(preferences, opts);
  return { items };
}

/**
 * Full personalized explore feed from user preferences.
 * @param {import('@/types/user').UserPreferences | null | undefined} preferences
 * @param {{ limit?: number; excludeMovieIds?: string[]; recommendedOnly?: boolean }} [opts]
 */
export async function loadPersonalizedExploreBundle(preferences, opts = {}) {
  const limit = Math.min(50, Math.max(1, opts.limit ?? DEFAULT_LIMIT));
  const excludeMovieIds = opts.excludeMovieIds;

  if (opts.recommendedOnly) {
    const recommended = await queryPersonalizedCatalog(preferences, {
      limit,
      excludeMovieIds,
    });
    return {
      recommended,
      spotlight: recommended,
      popularMovies: [],
      popularTv: [],
      newContent: [],
      upcomingContent: [],
    };
  }

  const [recommended, popularMovies, popularTv, newContent, upcomingContent] =
    await Promise.all([
      queryPersonalizedCatalog(preferences, { limit, excludeMovieIds }),
      queryPersonalizedCatalog(preferences, {
        limit,
        type: "movie",
        minVoteAverage: CATALOG_POPULAR_MIN_VOTE_AVERAGE,
      }),
      queryPersonalizedCatalog(preferences, {
        limit,
        type: "tv",
        minVoteAverage: CATALOG_POPULAR_MIN_VOTE_AVERAGE,
      }),
      queryPersonalizedNew(preferences, 20),
      queryPersonalizedUpcoming(preferences, 50),
    ]);

  return {
    recommended,
    spotlight: recommended,
    popularMovies,
    popularTv,
    newContent,
    upcomingContent,
  };
}
