const fs = require("fs");
const path = require("path");

// Load .env.local from project root
const envPath = path.join(__dirname, "..", "..", ".env.local");
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, "utf8");
  for (const line of content.split("\n")) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, "");
  }
}

const TMDB_BEARER = process.env.NEXT_PUBLIC_TMDB_BEARER || process.env.TMDB_API_KEY;
if (!TMDB_BEARER) {
  console.error("❌ Set NEXT_PUBLIC_TMDB_BEARER or TMDB_API_KEY in .env.local");
  process.exit(1);
}

const INPUT_FILE = path.join(__dirname, "imdb-movies-filtered.json");
const OUTPUT_FILE = path.join(__dirname, "tmdb-movies.json");

const TMDB_FIND_URL = "https://api.themoviedb.org/3/find";
const TMDB_MOVIE_URL = "https://api.themoviedb.org/3/movie";
const CONCURRENCY = 8;
const DELAY_BETWEEN_BATCHES_MS = 100;

const headers = {
  accept: "application/json",
  Authorization: `Bearer ${TMDB_BEARER}`,
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

let loggedAuthError = false;

async function fetchTmdbByImdbId(imdbId) {
  const url =
    `${TMDB_FIND_URL}/${encodeURIComponent(imdbId)}` +
    `?external_source=imdb_id`;

  const response = await fetch(url, { headers });

  if (!response.ok) {
    if (!loggedAuthError) {
      loggedAuthError = true;
      const text = await response.text();
      console.error(`TMDB auth/error (first occurrence): ${response.status} ${response.statusText}`);
      console.error(text.slice(0, 300));
    }
    return null;
  }

  const data = await response.json();

  if (!data.movie_results || data.movie_results.length === 0) {
    return null;
  }

  const movie = data.movie_results[0];

  return {
    backdrop_path: movie.backdrop_path,
    genre_ids: movie.genre_ids,
    id: movie.id,
    original_language: movie.original_language,
    original_title: movie.original_title,
    overview: movie.overview,
    popularity: movie.popularity,
    poster_path: movie.poster_path,
    release_date: movie.release_date,
    title: movie.title,
  };
}

/** Fetch full movie details for tagline, status, belongs_to_collection */
async function fetchTmdbMovieDetails(tmdbId) {
  const url = `${TMDB_MOVIE_URL}/${tmdbId}`;
  const response = await fetch(url, { headers });
  if (!response.ok) return null;
  const data = await response.json();
  return {
    tagline: data.tagline ?? null,
    status: data.status ?? null,
    belongs_to_collection: data.belongs_to_collection ?? null,
  };
}

/** Enrich one movie; returns { imdbId, title, runtimeSeconds, rating, tmdbData } */
async function enrichOne(item) {
  const { id: imdbId, title, runtimeSeconds, rating } = item;
  const tmdbData = await fetchTmdbByImdbId(imdbId);
  if (!tmdbData) return { imdbId, title, runtimeSeconds, rating, tmdbData: null };

  const details = await fetchTmdbMovieDetails(tmdbData.id);
  if (details) {
    tmdbData.tagline = details.tagline;
    tmdbData.status = details.status;
    tmdbData.belongs_to_collection = details.belongs_to_collection;
  }

  return { imdbId, title, runtimeSeconds, rating, tmdbData };
}

async function enrichMovies() {
  const input = JSON.parse(fs.readFileSync(INPUT_FILE, "utf8"));
  const movies = input.movies;

  const enriched = [];
  const start = Date.now();

  console.log(`Enriching ${movies.length} movies (concurrency: ${CONCURRENCY})...`);

  for (let i = 0; i < movies.length; i += CONCURRENCY) {
    const chunk = movies.slice(i, i + CONCURRENCY);
    const results = await Promise.all(chunk.map(enrichOne));

    for (const { imdbId, title, runtimeSeconds, rating, tmdbData } of results) {
      if (tmdbData) {
        enriched.push({
          imdb_id: imdbId,
          runtimeSeconds,
          rating,
          ...tmdbData,
        });
      }
    }

    const done = Math.min(i + CONCURRENCY, movies.length);
    if (done % 100 === 0 || done === movies.length) {
      console.log(`  ${done}/${movies.length} (${((Date.now() - start) / 1000).toFixed(1)}s)`);
    }

    await sleep(DELAY_BETWEEN_BATCHES_MS);
  }

  const json = JSON.stringify(
    { count: enriched.length, movies: enriched },
    null,
    2
  );
  // Replace unusual line terminators (U+2028, U+2029) with space so JSON stays valid (no raw newlines in strings)
  const sanitized = json.replace(/\u2028/g, " ").replace(/\u2029/g, " ");
  fs.writeFileSync(OUTPUT_FILE, sanitized, "utf8");

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`✅ Wrote ${enriched.length} movies to ${OUTPUT_FILE} (${elapsed}s)`);
}

// Run
enrichMovies().catch(console.error);
