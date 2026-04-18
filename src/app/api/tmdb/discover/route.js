/**
 * One-shot TMDB rails for Explore: trending (week) + popular movies/TV.
 * Shape matches /api/tmdb/popular items for SmallCard.
 */
function mapMovie(r) {
  return {
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
  };
}

function mapTv(r) {
  return {
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
  };
}

const LIMIT = 12;

export async function GET() {
  try {
    const token =
      process.env.NEXT_PUBLIC_TMDB_BEARER || process.env.TMDB_BEARER;
    if (!token) {
      return Response.json(
        {
          error: "Missing TMDB bearer token",
          trendingMovies: [],
          trendingTv: [],
          popularMovies: [],
          popularTv: [],
        },
        { status: 500 }
      );
    }

    const headers = {
      accept: "application/json",
      Authorization: `Bearer ${token}`,
    };

    const [tMovieRes, tTvRes, pMovieRes, pTvRes] = await Promise.all([
      fetch(
        "https://api.themoviedb.org/3/trending/movie/week?language=en-US",
        { headers, next: { revalidate: 3600 } }
      ),
      fetch(
        "https://api.themoviedb.org/3/trending/tv/week?language=en-US",
        { headers, next: { revalidate: 3600 } }
      ),
      fetch(
        "https://api.themoviedb.org/3/movie/popular?language=en-US&page=1",
        { headers, next: { revalidate: 3600 } }
      ),
      fetch("https://api.themoviedb.org/3/tv/popular?language=en-US&page=1", {
        headers,
        next: { revalidate: 3600 },
      }),
    ]);

    const empty = {
      trendingMovies: [],
      trendingTv: [],
      popularMovies: [],
      popularTv: [],
    };

    if (!tMovieRes.ok || !tTvRes.ok || !pMovieRes.ok || !pTvRes.ok) {
      return Response.json(
        { error: "One or more TMDB discover requests failed", ...empty },
        { status: 502 }
      );
    }

    const [tMovieJson, tTvJson, pMovieJson, pTvJson] = await Promise.all([
      tMovieRes.json(),
      tTvRes.json(),
      pMovieRes.json(),
      pTvRes.json(),
    ]);

    return Response.json({
      trendingMovies: (tMovieJson.results || [])
        .slice(0, LIMIT)
        .map(mapMovie),
      trendingTv: (tTvJson.results || []).slice(0, LIMIT).map(mapTv),
      popularMovies: (pMovieJson.results || [])
        .slice(0, LIMIT)
        .map(mapMovie),
      popularTv: (pTvJson.results || []).slice(0, LIMIT).map(mapTv),
    });
  } catch (err) {
    console.error(err);
    return Response.json(
      {
        error: "discover failed",
        trendingMovies: [],
        trendingTv: [],
        popularMovies: [],
        popularTv: [],
      },
      { status: 500 }
    );
  }
}
