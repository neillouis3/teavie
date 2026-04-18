/**
 * Catalog search only: `teavie.content` in MongoDB (no TMDB).
 * - Movies: released `release_date`
 * - Anime TV: `anime_*` ids + `releasedAnimeFirstAirClause`
 * - Other TV: same exclusion as /api/tv (`$nor` anime) + released `first_air_date`
 */

import clientPromise from "@/lib/mongo";
import {
  catalogAnimeIdMongoExpr,
  catalogTodayIsoUtc,
  escapeRegex,
  releasedAnimeFirstAirClause,
  releasedCatalogClause,
} from "@/lib/catalogQuery";
import { mapContentDocToItem } from "@/lib/mapContentDocToItem";

const DEFAULT_LIMIT = 28;

const notAnimeTv = {
  $nor: [{ is_anime: true }, { tags: "anime" }],
};

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const q = (searchParams.get("q") || "").trim();
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
    const titleNameOr = {
      $or: [
        { title: { $regex: safe, $options: "i" } },
        { name: { $regex: safe, $options: "i" } },
      ],
    };

    const todayIso = catalogTodayIsoUtc();
    const includeUnreleased = searchParams.get("include_unreleased") === "1";

    const movieReleased = includeUnreleased
      ? {}
      : releasedCatalogClause("release_date", todayIso);
    const movieBranch = includeUnreleased
      ? { $and: [{ type: "movie" }, titleNameOr] }
      : { $and: [{ type: "movie" }, titleNameOr, movieReleased] };

    const tvAnimeReleased = includeUnreleased ? {} : releasedAnimeFirstAirClause(todayIso);
    const tvAnimeBranch = includeUnreleased
      ? {
          $and: [{ type: "tv" }, titleNameOr, catalogAnimeIdMongoExpr()],
        }
      : {
          $and: [
            { type: "tv" },
            titleNameOr,
            catalogAnimeIdMongoExpr(),
            tvAnimeReleased,
          ],
        };

    const tvLiveReleased = includeUnreleased
      ? {}
      : releasedCatalogClause("first_air_date", todayIso);
    const tvLiveBranch = includeUnreleased
      ? { $and: [{ type: "tv" }, titleNameOr, notAnimeTv] }
      : {
          $and: [{ type: "tv" }, titleNameOr, notAnimeTv, tvLiveReleased],
        };

    const filter = {
      $or: [movieBranch, tvAnimeBranch, tvLiveBranch],
    };

    const client = await clientPromise;
    const col = client.db("teavie").collection("content");
    const skip = (clientPage - 1) * limit;

    const total = await col.countDocuments(filter);
    const docs = await col
      .find(filter)
      .sort({ popularity: -1, _id: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();

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
