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

const INPUT_FILE = path.join(__dirname, "imdb-tvshows-filtered.json");
const OUTPUT_FILE = path.join(__dirname, "tmdb-tvshows.json");

const TMDB_FIND_URL = "https://api.themoviedb.org/3/find";
const TMDB_TV_URL = "https://api.themoviedb.org/3/tv";
const CONCURRENCY = 8;
const DELAY_BETWEEN_BATCHES_MS = 100;

const headers = {
  accept: "application/json",
  Authorization: `Bearer ${TMDB_BEARER}`,
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

let loggedAuthError = false;

/** Find TMDb TV show by IMDb ID */
async function fetchTmdbTvByImdbId(imdbId) {
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

  if (!data.tv_results || data.tv_results.length === 0) {
    return null;
  }

  return data.tv_results[0].id; // TMDb TV id
}

/** Fetch full TV details: number_of_seasons, tagline, backdrop, genres, id, language, name, overview, popularity, poster, first_air_date, origin_country */
async function fetchTmdbTvDetails(tmdbId) {
  const url = `${TMDB_TV_URL}/${tmdbId}`;
  const response = await fetch(url, { headers });
  if (!response.ok) return null;
  const data = await response.json();

  return {
    id: data.id,
    name: data.name,
    title: data.name,
    overview: data.overview ?? null,
    tagline: data.tagline ?? null,
    backdrop_path: data.backdrop_path ?? null,
    poster_path: data.poster_path ?? null,
    genre_ids: data.genre_ids ?? [],
    genres: (data.genres || []).map((g) => ({ id: g.id, name: g.name })),
    original_language: data.original_language ?? null,
    first_air_date: data.first_air_date ?? null,
    origin_country: data.origin_country ?? [],
    popularity: data.popularity ?? 0,
    number_of_seasons: data.number_of_seasons ?? null,
  };
}

/** Enrich one TV show */
async function enrichOne(item) {
  const { id: imdbId, title, runtimeSeconds, rating } = item;
  const tmdbTvId = await fetchTmdbTvByImdbId(imdbId);
  if (!tmdbTvId) return { imdbId, title, runtimeSeconds, rating, details: null };

  const details = await fetchTmdbTvDetails(tmdbTvId);
  if (!details) return { imdbId, title, runtimeSeconds, rating, details: null };

  return { imdbId, title, runtimeSeconds, rating, details };
}

async function enrichTvShows() {
  const input = JSON.parse(fs.readFileSync(INPUT_FILE, "utf8"));
  const shows = input.movies ?? input.shows ?? []; // support "movies" or "shows" key

  const enriched = [];
  const start = Date.now();

  console.log(`Enriching ${shows.length} TV shows (concurrency: ${CONCURRENCY})...`);

  for (let i = 0; i < shows.length; i += CONCURRENCY) {
    const chunk = shows.slice(i, i + CONCURRENCY);
    const results = await Promise.all(chunk.map(enrichOne));

    for (const { imdbId, title, runtimeSeconds, rating, details } of results) {
      if (details) {
        enriched.push({
          imdb_id: imdbId,
          runtimeSeconds: runtimeSeconds ?? null,
          rating: rating ?? null,
          ...details,
        });
      }
    }

    const done = Math.min(i + CONCURRENCY, shows.length);
    if (done % 100 === 0 || done === shows.length) {
      console.log(`  ${done}/${shows.length} (${((Date.now() - start) / 1000).toFixed(1)}s)`);
    }

    await sleep(DELAY_BETWEEN_BATCHES_MS);
  }

  const json = JSON.stringify(
    { count: enriched.length, shows: enriched },
    null,
    2
  );
  const sanitized = json.replace(/\u2028/g, " ").replace(/\u2029/g, " ");
  fs.writeFileSync(OUTPUT_FILE, sanitized, "utf8");

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`✅ Wrote ${enriched.length} TV shows to ${OUTPUT_FILE} (${elapsed}s)`);
}

enrichTvShows().catch(console.error);
