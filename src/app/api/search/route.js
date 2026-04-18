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
import { catalogPopularityScore } from "@/lib/catalogPopularity";

const DEFAULT_LIMIT = 28;

const notAnimeTv = {
  $nor: [{ is_anime: true }, { tags: "anime" }],
};

function mapCatalogRow(doc) {
  const rawDate =
    doc.release_date ??
    doc.releaseDate ??
    doc.first_air_date ??
    doc.firstAirDate ??
    null;
  const release_date =
    rawDate == null
      ? null
      : typeof rawDate === "string"
        ? rawDate
        : rawDate.toISOString?.().split("T")[0] ?? null;
  const isAnimeRow = String(doc.id ?? "").startsWith("anime_");
  return {
    id: doc.id.toString(),
    title: doc.title ?? doc.name,
    name: doc.name ?? doc.title,
    release_date,
    first_air_date: doc.type === "tv" ? doc.first_air_date ?? null : null,
    poster_path: doc.poster_path ?? null,
    backdrop_path: doc.backdrop_path ?? null,
    overview: doc.overview ?? null,
    type: doc.type,
    runtimeSeconds: doc.runtimeSeconds ?? null,
    season_amount:
      doc.type === "tv"
        ? doc.season_amount ?? doc.number_of_seasons ?? 0
        : 0,
    popularity: catalogPopularityScore(
      doc,
      isAnimeRow ? { anime: true } : undefined
    ),
    vote_average: doc.vote_average ?? null,
  };
}

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
      results: docs.map(mapCatalogRow),
    });
  } catch (err) {
    console.error(err);
    return Response.json(
      { error: "Search failed", results: [], total: 0 },
      { status: 500 }
    );
  }
}
