import {
  buildCatalogFilter,
  catalogTodayIsoUtc,
  releasedCatalogClause,
} from "@/lib/catalogQuery";
import { mapCatalogListDoc } from "@/lib/mapContentDocToItem";
import { handleCatalogBrowseGet } from "@/lib/api/catalogBrowseRoute";

export async function GET(req) {
  try {
    return handleCatalogBrowseGet(req, {
      namespace: "movies",
      buildFilter: (searchParams) => {
        const base = buildCatalogFilter(searchParams, {
          type: "movie",
          dateField: "release_date",
        });
        const includeUnreleased = searchParams.get("include_unreleased") === "1";
        const todayIso = catalogTodayIsoUtc();
        return includeUnreleased
          ? base
          : { $and: [base, releasedCatalogClause("release_date", todayIso)] };
      },
      mapRow: mapCatalogListDoc,
      browseOptions: {},
      sortOptions: {
        titleAsc: { title: 1, _id: -1 },
        titleDesc: { title: -1, _id: -1 },
        dateDesc: { release_date: -1, _id: -1 },
        dateAsc: { release_date: 1, _id: -1 },
      },
    });
  } catch (err) {
    console.error(err);
    return Response.json({ error: "Failed to fetch movies" }, { status: 500 });
  }
}
