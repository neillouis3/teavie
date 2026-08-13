/**
 * Refresh TMDB popularity + vote stats on catalog rows.
 * TMDB scores live on `vote_average` / `vote_count` and `tmdb.*`.
 * IMDb scores live only under `omdb.*` (see update-content-from-omdb.js).
 */
import { MongoClient } from "mongodb";
import { hasTmdbAuth, tmdbAuth, tmdbFetchJson } from "./tmdbAuth.js";

const DB_NAME = "teavie";
const COLLECTION = "content";
const TMDB_BASE = "https://api.themoviedb.org/3";
const FETCH_TIMEOUT_MS = 15000;
const SLEEP_MS = 35;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function tmdbStatsFromMovie(movie) {
  /** @type {Record<string, unknown>} */
  const set = { updatedAt: new Date() };
  if (typeof movie.popularity === "number" && Number.isFinite(movie.popularity)) {
    set.popularity = movie.popularity;
  }
  if (
    typeof movie.vote_average === "number" &&
    Number.isFinite(movie.vote_average) &&
    movie.vote_average > 0
  ) {
    set.vote_average = movie.vote_average;
  }
  if (
    typeof movie.vote_count === "number" &&
    Number.isFinite(movie.vote_count)
  ) {
    set.vote_count = movie.vote_count;
  }
  if (
    typeof movie.vote_average === "number" &&
    Number.isFinite(movie.vote_average)
  ) {
    set.tmdb = {
      vote_average: movie.vote_average,
      vote_count:
        typeof movie.vote_count === "number" && Number.isFinite(movie.vote_count)
          ? movie.vote_count
          : 0,
      updatedAt: new Date(),
    };
  }
  return set;
}

function tmdbStatsFromTv(show) {
  /** @type {Record<string, unknown>} */
  const set = { updatedAt: new Date() };
  if (typeof show.popularity === "number" && Number.isFinite(show.popularity)) {
    set.popularity = show.popularity;
  }
  if (
    typeof show.vote_average === "number" &&
    Number.isFinite(show.vote_average) &&
    show.vote_average > 0
  ) {
    set.vote_average = show.vote_average;
  }
  if (
    typeof show.vote_count === "number" &&
    Number.isFinite(show.vote_count)
  ) {
    set.vote_count = show.vote_count;
  }
  if (
    typeof show.vote_average === "number" &&
    Number.isFinite(show.vote_average)
  ) {
    set.tmdb = {
      vote_average: show.vote_average,
      vote_count:
        typeof show.vote_count === "number" && Number.isFinite(show.vote_count)
          ? show.vote_count
          : 0,
      updatedAt: new Date(),
    };
  }
  if (typeof show.last_air_date === "string" && show.last_air_date.trim()) {
    set.last_air_date = show.last_air_date.trim().slice(0, 10);
  }
  if (
    typeof show.number_of_episodes === "number" &&
    Number.isFinite(show.number_of_episodes) &&
    show.number_of_episodes > 0
  ) {
    set.number_of_episodes = show.number_of_episodes;
  }
  if (
    typeof show.number_of_seasons === "number" &&
    Number.isFinite(show.number_of_seasons) &&
    show.number_of_seasons > 0
  ) {
    set.number_of_seasons = show.number_of_seasons;
  }
  return set;
}

async function tmdbGet(pathWithQuery, bearerOverride) {
  const url = pathWithQuery.startsWith("http")
    ? pathWithQuery
    : `${TMDB_BASE}${pathWithQuery}`;
  const auth = bearerOverride
    ? { kind: "bearer", value: bearerOverride }
    : tmdbAuth();
  if (!auth) throw new Error("Missing TMDB auth");
  return tmdbFetchJson(url, auth, { timeoutMs: FETCH_TIMEOUT_MS });
}

/**
 * @param {{
 *   dryRun?: boolean;
 *   cap?: number;
 *   type?: "movie" | "tv" | "all";
 *   token?: string;
 *   mongoUri?: string;
 *   onLog?: (msg: string) => void;
 * }} opts
 */
export async function runCatalogTmdbStatsRefresh(opts = {}) {
  const dryRun = Boolean(opts.dryRun);
  const cap = Math.max(1, Number(opts.cap) || 500);
  const type = opts.type === "movie" || opts.type === "tv" ? opts.type : "all";
  const log = opts.onLog || ((m) => console.log(m));

  const bearerOverride = (
    opts.token ||
    process.env.TMDB_BEARER ||
    process.env.NEXT_PUBLIC_TMDB_BEARER ||
    ""
  ).trim() || null;
  const uri = (opts.mongoUri || process.env.MONGODB_URI || "").trim();
  if (!hasTmdbAuth() && !bearerOverride) {
    throw new Error("Missing TMDB_BEARER or TMDB_API_KEY");
  }
  if (!uri) throw new Error("Missing MONGODB_URI");

  const authMode = bearerOverride
    ? "bearer"
    : tmdbAuth()?.kind ?? "none";

  const typeFilter =
    type === "all" ? { type: { $in: ["movie", "tv"] } } : { type };

  const client = new MongoClient(uri);
  await client.connect();
  const col = client.db(DB_NAME).collection(COLLECTION);

  const rows = await col
    .find({
      ...typeFilter,
      id: { $type: ["int", "long", "double"] },
    })
    .project({ id: 1, type: 1, title: 1, name: 1, omdb: 1 })
    .sort({ vote_average: 1, updatedAt: 1, _id: 1 })
    .limit(cap)
    .toArray();

  log(
    `tmdb stats refresh | type=${type} cap=${cap} queue=${rows.length} dryRun=${dryRun} auth=${authMode}`
  );

  let ok = 0;
  let err = 0;
  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    const id = Number(row.id);
    if (!Number.isFinite(id) || id <= 0) continue;

    try {
      const path =
        row.type === "movie"
          ? `/movie/${id}?language=en-US`
          : `/tv/${id}?language=en-US`;
      const json = await tmdbGet(path, bearerOverride);
      const set =
        row.type === "movie"
          ? tmdbStatsFromMovie(json)
          : tmdbStatsFromTv(json);

      if (Object.keys(set).length <= 1) {
        err += 1;
        continue;
      }

      if (!dryRun) {
        await col.updateOne({ _id: row._id }, { $set: set });
      }
      ok += 1;
    } catch (e) {
      err += 1;
      if (err <= 5) {
        log(
          `warn id=${row.id} ${row.title ?? row.name ?? ""}: ${e instanceof Error ? e.message : String(e)}`
        );
      }
    }

    if ((i + 1) % 50 === 0) log(`progress ${i + 1}/${rows.length} ok=${ok} err=${err}`);
    await sleep(SLEEP_MS);
  }

  await client.close();
  log(`done: ok=${ok} err=${err} dryRun=${dryRun}`);
  return { ok, err, dryRun, queued: rows.length };
}
