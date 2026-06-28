/**
 * Unified genre catalog: movies + TV (or filtered by type).
 */

import { queryGenreRail } from "@/lib/api/genreRail";
import { isValidImdbGenreSlug } from "@/lib/imdbGenres";

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const slug = searchParams.get("slug")?.trim() ?? "";

    if (!isValidImdbGenreSlug(slug)) {
      return Response.json({ error: "Invalid genre" }, { status: 400 });
    }

    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(
      48,
      Math.max(1, parseInt(searchParams.get("limit") || "28", 10))
    );

    const payload = await queryGenreRail({
      slug,
      type: searchParams.get("type")?.trim() || "all",
      sort: searchParams.get("sort") ?? "popular",
      page,
      limit,
      searchParams,
    });

    if (payload.error) {
      return Response.json({ error: payload.error }, { status: payload.status ?? 400 });
    }

    return Response.json(payload);
  } catch (err) {
    console.error(err);
    return Response.json({ error: "Genre fetch failed" }, { status: 500 });
  }
}
