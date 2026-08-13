import {
  buildKdramaCatalogFilter,
  catalogTodayIsoUtc,
  catalogTvBrowseReleasedClause,
} from "@/lib/catalogQuery";
import {
  catalogDisplayVoteAverage,
  catalogPopularityScore,
} from "@/lib/catalogPopularity";
import { mapCatalogListDoc } from "@/lib/mapContentDocToItem";
import { handleCatalogBrowseGet } from "@/lib/api/catalogBrowseRoute";

function mapKdramaRow(doc) {
  return mapCatalogListDoc({
    ...doc,
    vote_average: catalogDisplayVoteAverage(doc),
    popularity: catalogPopularityScore(doc),
  });
}

export async function GET(req) {
  try {
    return handleCatalogBrowseGet(req, {
      namespace: "kdrama",
      buildFilter: (searchParams) => {
        const includeUnreleased = searchParams.get("include_unreleased") === "1";
        const todayIso = catalogTodayIsoUtc();
        const core = buildKdramaCatalogFilter(searchParams);
        return includeUnreleased
          ? core
          : {
              $and: [core, catalogTvBrowseReleasedClause("first_air_date", todayIso)],
            };
      },
      mapRow: mapKdramaRow,
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
    return Response.json({ error: "Failed to fetch K-Drama" }, { status: 500 });
  }
}
