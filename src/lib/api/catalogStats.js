import clientPromise from "@/lib/mongo";
import {
  buildCatalogFilter,
  buildKdramaCatalogFilter,
  catalogAnimeIdMongoExpr,
  catalogExcludeAdultAnimeMongoClause,
  catalogTodayIsoUtc,
  catalogTvBrowseNonAnimeClause,
  catalogTvBrowseReleasedClause,
  releasedAnimeFirstAirClause,
  releasedCatalogClause,
} from "@/lib/catalogQuery";
import { catalogAnimeSplitCourHiddenClause } from "@/lib/animeSplitCour";

function emptySearchParams() {
  return new URLSearchParams();
}

/**
 * Released catalog counts aligned with each browse-all API (no filters).
 * @returns {Promise<{ movies: number; tv: number; anime: number; kdrama: number; total: number }>}
 */
export async function loadCatalogStats() {
  const client = await clientPromise;
  const collection = client.db("teavie").collection("content");
  const todayIso = catalogTodayIsoUtc();
  const params = emptySearchParams();

  const movieFilter = {
    $and: [
      buildCatalogFilter(params, { type: "movie", dateField: "release_date" }),
      releasedCatalogClause("release_date", todayIso),
    ],
  };

  const tvCore = buildCatalogFilter(params, {
    type: "tv",
    dateField: "first_air_date",
    animeMultilingualTitleSearch: true,
  });
  const tvFilter = {
    $and: [
      tvCore,
      catalogTvBrowseNonAnimeClause(),
      catalogTvBrowseReleasedClause("first_air_date", todayIso),
    ],
  };

  const animeBase = buildCatalogFilter(params, {
    type: "tv",
    dateField: "first_air_date",
    animeMultilingualTitleSearch: true,
  });
  const animeFilter = {
    $and: [
      animeBase,
      catalogAnimeIdMongoExpr(),
      catalogAnimeSplitCourHiddenClause(),
      catalogExcludeAdultAnimeMongoClause(),
      releasedAnimeFirstAirClause(todayIso),
    ],
  };

  const kdramaFilter = {
    $and: [
      buildKdramaCatalogFilter(params),
      catalogTvBrowseReleasedClause("first_air_date", todayIso),
    ],
  };

  const [movies, tv, anime, kdrama] = await Promise.all([
    collection.countDocuments(movieFilter),
    collection.countDocuments(tvFilter),
    collection.countDocuments(animeFilter),
    collection.countDocuments(kdramaFilter),
  ]);

  return {
    movies,
    tv,
    anime,
    kdrama,
    total: movies + tv + anime + kdrama,
  };
}
