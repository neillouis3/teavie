import {
  buildCatalogFilter,
  catalogAnimeIdMongoExpr,
  catalogExcludeAdultAnimeMongoClause,
  catalogTodayIsoUtc,
  releasedAnimeFirstAirClause,
} from "@/lib/catalogQuery";
import {
  catalogDisplayVoteAverage,
  catalogPopularityScore,
  mongoAnimeCatalogPopularityExpr,
} from "@/lib/catalogPopularity";
import { mapCatalogListDoc } from "@/lib/mapContentDocToItem";
import {
  mergedSplitCourEpisodeCount,
  splitCourGroupForMal,
  catalogAnimeSplitCourHiddenClause,
} from "@/lib/animeSplitCour";
import { handleCatalogBrowseGet } from "@/lib/api/catalogBrowseRoute";

function mapAnimeRow(doc) {
  const mapped = mapCatalogListDoc({
    ...doc,
    vote_average: catalogDisplayVoteAverage(doc),
    popularity: catalogPopularityScore(doc, { anime: true }),
  });
  const group = splitCourGroupForMal(doc.mal_id);
  if (group && group.primaryMalId === Number(doc.mal_id)) {
    mapped.number_of_episodes = mergedSplitCourEpisodeCount(group);
  }
  return mapped;
}

export async function GET(req) {
  try {
    return handleCatalogBrowseGet(req, {
      namespace: "anime",
      buildFilter: (searchParams) => {
        const base = buildCatalogFilter(searchParams, {
          type: "tv",
          dateField: "first_air_date",
          animeMultilingualTitleSearch: true,
        });
        const includeUnreleased = searchParams.get("include_unreleased") === "1";
        const todayIso = catalogTodayIsoUtc();
        const released = includeUnreleased ? [] : [releasedAnimeFirstAirClause(todayIso)];
        return {
          $and: [
            base,
            catalogAnimeIdMongoExpr(),
            catalogAnimeSplitCourHiddenClause(),
            catalogExcludeAdultAnimeMongoClause(),
            ...released,
          ],
        };
      },
      mapRow: mapAnimeRow,
      popExpr: mongoAnimeCatalogPopularityExpr(),
      browseOptions: { anime: true },
      sortOptions: {
        titleAsc: { name: 1, _id: -1 },
        titleDesc: { name: -1, _id: -1 },
        dateDesc: { first_air_date: -1, _id: -1 },
        dateAsc: { first_air_date: 1, _id: -1 },
      },
    });
  } catch (err) {
    console.error(err);
    return Response.json({ error: "Failed to fetch anime" }, { status: 500 });
  }
}
