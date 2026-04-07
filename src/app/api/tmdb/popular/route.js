/**
 * TMDB popular movies + TV for browse state on /search (no query).
 */
export async function GET() {
  try {
    const token =
      process.env.NEXT_PUBLIC_TMDB_BEARER || process.env.TMDB_BEARER;
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
        "https://api.themoviedb.org/3/movie/popular?language=en-US&page=1",
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

    const movieData = await movieRes.json();
    const tvData = await tvRes.json();

    const movies = (movieData.results || []).slice(0, 10).map((r) => ({
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

    const tv = (tvData.results || []).slice(0, 10).map((r) => ({
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
