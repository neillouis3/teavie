import clientPromise from "@/lib/mongo";
import {
  buildCatalogFilter,
  catalogSort,
  catalogTodayIsoUtc,
  releasedCatalogClause,
} from "@/lib/catalogQuery";
import { catalogPopularityScore } from "@/lib/catalogPopularity";
import { catalogDocReleaseDateString } from "@/lib/mapContentDocToItem";

export async function GET(req) {
  try {
    const client = await clientPromise;
    const collection = client.db("teavie").collection("content");

    const { searchParams } = new URL(req.url);

    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(
      48,
      Math.max(1, parseInt(searchParams.get("limit") || "28", 10))
    );
    const skip = (page - 1) * limit;

    const sortBy = searchParams.get("sort_by") || "title";
    const sort = catalogSort(sortBy, {
      titleAsc: { title: 1, _id: -1 },
      titleDesc: { title: -1, _id: -1 },
      dateDesc: { release_date: -1, _id: -1 },
      dateAsc: { release_date: 1, _id: -1 },
    });

    const base = buildCatalogFilter(searchParams, {
      type: "movie",
      dateField: "release_date",
    });
    const includeUnreleased = searchParams.get("include_unreleased") === "1";
    const todayIso = catalogTodayIsoUtc();
    const filter = includeUnreleased
      ? base
      : { $and: [base, releasedCatalogClause("release_date", todayIso)] };

    const [total, results] = await Promise.all([
      collection.countDocuments(filter),
      collection.find(filter).sort(sort).skip(skip).limit(limit).toArray(),
    ]);

    return Response.json({
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      results: results.map((doc) => ({
        id: doc.id.toString(),
        title: doc.title ?? doc.name,
        release_date: catalogDocReleaseDateString(doc),
        runtimeSeconds: doc.runtimeSeconds ?? null,
        season_amount: doc.season_amount ?? null,
        popularity: catalogPopularityScore(doc),
        vote_average: doc.vote_average ?? null,
        genre_ids: doc.genre_ids ?? [],
        poster_path: doc.poster_path ?? null,
        backdrop_path: doc.backdrop_path ?? null,
        type: doc.type,
      })),
    });
  } catch (err) {
    console.error(err);
    return Response.json({ error: "Failed to fetch movies" }, { status: 500 });
  }
}
