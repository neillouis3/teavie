import { tmdbBearerToken } from "@/lib/tmdbAuth";
import { passesPopularQualityGate } from "@/lib/catalogPopularity";

/**
 * TMDB popular movies + TV for browse state on /search (no query).
 * First page has up to 20 rows; optional `?limit=` (default 20, max 20).
 */
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const limitRaw = searchParams.get("limit");
    const parsed = limitRaw ? parseInt(limitRaw, 10) : NaN;
    const cap =
      Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, 20) : 20;

    const token = tmdbBearerToken();
    if (!token) {
      return Response.json(
        { error: "Missing TMDB bearer token", movies: [], tv: [] },
        { status: 500 }
      );
    }

    const headers = {
      accept: "application/json",
      Authorization: `Bearer ${token}`,
    };

    const [movieRes, tvRes] = await Promise.all([
      fetch(
        "https://api.themoviedb.org/3/movie/popular?language=en-US&include_adult=false&page=1",
        { headers, next: { revalidate: 3600 } }
      ),
      fetch("https://api.themoviedb.org/3/tv/popular?language=en-US&page=1", {
        headers,
        next: { revalidate: 3600 },
      }),
    ]);

    if (!movieRes.ok || !tvRes.ok) {
      return Response.json(
        { error: "Popular request failed", movies: [], tv: [] },
        { status: 502 }
      );
    }

    const [movieData, tvData] = await Promise.all([movieRes.json(), tvRes.json()]);

    const movies = (movieData.results || [])
      .filter((r) => !r.adult && passesPopularQualityGate(r))
      .slice(0, cap)
      .map((r) => ({
      id: r.id,
      title: r.title,
      name: r.title,
      release_date: r.release_date ?? null,
      first_air_date: null,
      poster_path: r.poster_path ?? null,
      backdrop_path: r.backdrop_path ?? null,
      overview: r.overview ?? null,
      type: "movie",
      runtimeSeconds: null,
      season_amount: 0,
      vote_average: r.vote_average ?? null,
    }));

    const tv = (tvData.results || [])
      .filter((r) => !r.adult && passesPopularQualityGate(r))
      .slice(0, cap)
      .map((r) => ({
      id: r.id,
      title: r.name,
      name: r.name,
      release_date: null,
      first_air_date: r.first_air_date ?? null,
      poster_path: r.poster_path ?? null,
      backdrop_path: r.backdrop_path ?? null,
      overview: r.overview ?? null,
      type: "tv",
      runtimeSeconds: null,
      season_amount: r.number_of_seasons ?? 0,
      vote_average: r.vote_average ?? null,
    }));

    return Response.json({ movies, tv });
  } catch (err) {
    console.error(err);
    return Response.json(
      { error: "Popular failed", movies: [], tv: [] },
      { status: 500 }
    );
  }
}
