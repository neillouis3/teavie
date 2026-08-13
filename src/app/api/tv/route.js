import {
  buildCatalogFilter,
  catalogSort,
  catalogTodayIsoUtc,
  catalogTvBrowseNonAnimeClause,
  catalogTvBrowseReleasedClause,
  catalogExcludeBlockedTmdbTvMongoClause,
} from "@/lib/catalogQuery";
import {
  catalogDisplayVoteAverage,
  catalogPopularityScore,
  mongoMixedTvCatalogPopularityExpr,
} from "@/lib/catalogPopularity";
import { mapCatalogListDoc } from "@/lib/mapContentDocToItem";
import { handleCatalogBrowseGet } from "@/lib/api/catalogBrowseRoute";

function mapTvRow(doc) {
  return mapCatalogListDoc({
    ...doc,
    vote_average: catalogDisplayVoteAverage(doc),
    popularity: catalogPopularityScore(doc),
  });
}

export async function GET(req) {
  try {
    return handleCatalogBrowseGet(req, {
      namespace: "tv",
      buildFilter: (searchParams) => {
        const core = buildCatalogFilter(searchParams, {
          type: "tv",
          dateField: "first_air_date",
          animeMultilingualTitleSearch: true,
        });
        const includeUnreleased = searchParams.get("include_unreleased") === "1";
        const todayIso = catalogTodayIsoUtc();
        const clauses = [
          core,
          catalogTvBrowseNonAnimeClause(),
          catalogExcludeBlockedTmdbTvMongoClause(),
        ];
        if (!includeUnreleased) {
          clauses.push(catalogTvBrowseReleasedClause("first_air_date", todayIso));
        }
        return { $and: clauses };
      },
      mapRow: mapTvRow,
      popExpr: mongoMixedTvCatalogPopularityExpr(),
      browseOptions: {},
      sortOptions: {
        titleAsc: { name: 1, _id: -1 },
        titleDesc: { name: -1, _id: -1 },
        dateDesc: { first_air_date: -1, _id: -1 },
        dateAsc: { first_air_date: 1, _id: -1 },
      },
    });
  } catch (err) {
    console.error(err);
    return Response.json({ error: "Failed to fetch tv shows" }, { status: 500 });
  }
}
