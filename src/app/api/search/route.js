/**
 * TMDB multi search (movies + TV). Uses same bearer as the rest of the app.
 * @see https://developer.themoviedb.org/reference/search-multi
 */
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const q = (searchParams.get("q") || "").trim();
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));

    if (!q) {
      return Response.json({
        page: 1,
        limit: 20,
        total: 0,
        totalPages: 0,
        results: [],
      });
    }

    const token =
      process.env.NEXT_PUBLIC_TMDB_BEARER || process.env.TMDB_BEARER;
    if (!token) {
      return Response.json(
        { error: "Missing TMDB bearer token", results: [], total: 0 },
        { status: 500 }
      );
    }

    const url = new URL("https://api.themoviedb.org/3/search/multi");
    url.searchParams.set("query", q);
    url.searchParams.set("include_adult", "false");
    url.searchParams.set("language", "en-US");
    url.searchParams.set("page", String(page));

    const res = await fetch(url.toString(), {
      headers: {
        accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("TMDB search error:", res.status, errText);
      return Response.json(
        { error: "Search request failed", results: [], total: 0 },
        { status: res.status }
      );
    }

    const data = await res.json();
    const rows = (data.results || []).filter(
      (r) => r.media_type === "movie" || r.media_type === "tv"
    );

    const results = rows.map((r) => {
      if (r.media_type === "movie") {
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
          popularity: r.popularity ?? 0,
        };
      }
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
        popularity: r.popularity ?? 0,
      };
    });

    return Response.json({
      page: data.page ?? page,
      limit: 20,
      total: data.total_results ?? results.length,
      totalPages: data.total_pages ?? 1,
      results,
    });
  } catch (err) {
    console.error(err);
    return Response.json(
      { error: "Search failed", results: [], total: 0 },
      { status: 500 }
    );
  }
}
