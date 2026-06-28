/**
 * Popular-genre ranking for Discover and genres index.
 */

import { loadPopularGenres } from "@/lib/api/popularGenres";

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const sortByName = searchParams.get("sort") === "name";
    const genres = await loadPopularGenres(sortByName);
    return Response.json({ genres });
  } catch (err) {
    console.error(err);
    return Response.json(
      { genres: [], error: "popular genres failed" },
      { status: 500 }
    );
  }
}
