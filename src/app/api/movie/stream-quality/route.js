import { tmdbBearerToken } from "@/lib/tmdbAuth";
import { inferMovieStreamQuality } from "@/lib/streamQuality";

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id")?.trim();
    if (!id || !/^\d+$/.test(id)) {
      return Response.json({ error: "Provide a valid TMDB movie id" }, { status: 400 });
    }

    const token = tmdbBearerToken();
    if (!token) {
      return Response.json({ quality: "hd" });
    }

    const res = await fetch(
      `https://api.themoviedb.org/3/movie/${id}?language=en-US&append_to_response=release_dates`,
      {
        headers: {
          accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
        next: { revalidate: 86_400 },
      }
    );

    if (!res.ok) {
      return Response.json({ quality: "hd" });
    }

    const movie = await res.json();
    const quality = inferMovieStreamQuality(
      movie?.release_dates,
      movie?.release_date
    );

    return Response.json(
      { quality },
      {
        headers: {
          "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=3600",
        },
      }
    );
  } catch (err) {
    console.error("GET /api/movie/stream-quality", err);
    return Response.json({ quality: "hd" });
  }
}
