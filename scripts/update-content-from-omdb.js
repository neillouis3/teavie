/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");
const { MongoClient } = require("mongodb");

const DB_NAME = "teavie";
const COLLECTION = "content";
const OMDB_BASE = "https://www.omdbapi.com/";

const GENRE_MAP_MOVIE = {
  action: 28,
  adventure: 12,
  animation: 16,
  comedy: 35,
  crime: 80,
  documentary: 99,
  drama: 18,
  family: 10751,
  fantasy: 14,
  history: 36,
  horror: 27,
  music: 10402,
  mystery: 9648,
  romance: 10749,
  "science fiction": 878,
  "tv movie": 10770,
  thriller: 53,
  war: 10752,
  western: 37,
};

const GENRE_MAP_TV = {
  "action & adventure": 10759,
  action: 10759,
  adventure: 10759,
  animation: 16,
  comedy: 35,
  crime: 80,
  documentary: 99,
  drama: 18,
  family: 10751,
  kids: 10762,
  mystery: 9648,
  news: 10763,
  reality: 10764,
  "sci-fi & fantasy": 10765,
  "science fiction": 10765,
  fantasy: 10765,
  soap: 10766,
  talk: 10767,
  "war & politics": 10768,
  western: 37,
};

function loadEnvLocal() {
  const envPath = path.join(__dirname, "..", ".env.local");
  if (!fs.existsSync(envPath)) return;
  const content = fs.readFileSync(envPath, "utf8");
  for (const line of content.split("\n")) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!m) continue;
    const k = m[1].trim();
    const v = m[2].trim().replace(/^["']|["']$/g, "");
    if (!process.env[k]) process.env[k] = v;
  }
}

function argValue(flag, fallback = null) {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return fallback;
  return process.argv[idx + 1] ?? fallback;
}

function hasFlag(flag) {
  return process.argv.includes(flag);
}

function toYear(value) {
  if (typeof value !== "string") return "";
  const m = /^(\d{4})/.exec(value.trim());
  return m ? m[1] : "";
}

function parseOmdbReleased(value) {
  if (typeof value !== "string") return null;
  if (!value || value === "N/A") return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

function parseRuntimeSeconds(value) {
  if (typeof value !== "string") return null;
  const m = /(\d+)\s*min/i.exec(value);
  if (!m) return null;
  const mins = Number(m[1]);
  if (!Number.isFinite(mins) || mins <= 0) return null;
  return mins * 60;
}

function parseNumber(value) {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const n = Number(String(value).replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

function normalizeGenre(name) {
  return String(name || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function mapOmdbGenresToTmdbIds(genreRaw, type) {
  if (typeof genreRaw !== "string" || !genreRaw.trim() || genreRaw === "N/A") return [];
  const map = type === "movie" ? GENRE_MAP_MOVIE : GENRE_MAP_TV;
  const ids = genreRaw
    .split(",")
    .map((g) => normalizeGenre(g))
    .map((g) => map[g])
    .filter((id) => Number.isFinite(id));
  return [...new Set(ids)];
}

function pickDocTitle(doc) {
  const t = typeof doc.title === "string" && doc.title.trim() ? doc.title.trim() : "";
  const n = typeof doc.name === "string" && doc.name.trim() ? doc.name.trim() : "";
  return t || n;
}

function pickDocYear(doc) {
  if (doc.type === "movie") {
    return toYear(doc.release_date || "");
  }
  return toYear(doc.first_air_date || "");
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchOmdb(apiKey, params) {
  const url = new URL(OMDB_BASE);
  url.searchParams.set("apikey", apiKey);
  url.searchParams.set("r", "json");
  url.searchParams.set("plot", "short");
  for (const [k, v] of Object.entries(params)) {
    if (v != null && String(v).trim()) url.searchParams.set(k, String(v));
  }

  const res = await fetch(url.toString(), { headers: { Accept: "application/json" } });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OMDb HTTP ${res.status}: ${text.slice(0, 200)}`);
  }
  const payload = await res.json();
  return payload;
}

function buildSetPayload(doc, omdb, imdbHelpers) {
  const set = {};
  const unset = {};

  const omdbType = doc.type === "movie" ? "movie" : "series";
  const title = typeof omdb.Title === "string" && omdb.Title !== "N/A" ? omdb.Title.trim() : "";
  const released = parseOmdbReleased(omdb.Released);
  const runtimeSeconds = parseRuntimeSeconds(omdb.Runtime);
  const voteAverage = parseNumber(omdb.imdbRating);
  const imdbVotes = parseNumber(omdb.imdbVotes);
  const seasonAmount = parseNumber(omdb.totalSeasons);

  if (title) {
    if (doc.type === "movie") set.title = title;
    else set.name = title;
  }

  if (doc.type === "movie" && released) set.release_date = released;
  if (doc.type === "tv" && released) set.first_air_date = released;

  if (runtimeSeconds != null) set.runtimeSeconds = runtimeSeconds;
  if (voteAverage != null) set.vote_average = voteAverage;
  if (imdbVotes != null && imdbVotes > 0) set.vote_count = imdbVotes;
  if (doc.type === "tv" && seasonAmount != null) set.season_amount = seasonAmount;

  const overview = typeof omdb.Plot === "string" && omdb.Plot !== "N/A" ? omdb.Plot.trim() : "";
  if (overview) set.overview = overview;

  const imdbId = typeof omdb.imdbID === "string" && omdb.imdbID !== "N/A" ? omdb.imdbID.trim() : "";
  if (imdbId) set.imdb_id = imdbId;

  const details = {
    source: "omdb",
    type: omdbType,
    rated: omdb.Rated && omdb.Rated !== "N/A" ? omdb.Rated : null,
    year: omdb.Year && omdb.Year !== "N/A" ? omdb.Year : null,
    released: omdb.Released && omdb.Released !== "N/A" ? omdb.Released : null,
    genre: omdb.Genre && omdb.Genre !== "N/A" ? omdb.Genre : null,
    director: omdb.Director && omdb.Director !== "N/A" ? omdb.Director : null,
    writer: omdb.Writer && omdb.Writer !== "N/A" ? omdb.Writer : null,
    actors: omdb.Actors && omdb.Actors !== "N/A" ? omdb.Actors : null,
    language: omdb.Language && omdb.Language !== "N/A" ? omdb.Language : null,
    country: omdb.Country && omdb.Country !== "N/A" ? omdb.Country : null,
    awards: omdb.Awards && omdb.Awards !== "N/A" ? omdb.Awards : null,
    metascore: parseNumber(omdb.Metascore),
    imdbRating: voteAverage,
    imdbVotes,
    totalSeasons: seasonAmount,
    ratingsUpdatedAt: new Date().toISOString(),
  };

  set.omdb = details;

  const merged = { ...doc, ...set };
  const imdb_genres = imdbHelpers.imdbGenresForDoc(merged);
  if (imdb_genres.length > 0) set.imdb_genres = imdb_genres;

  if (imdbHelpers.isKdramaDoc(merged)) {
    Object.assign(set, imdbHelpers.kdramaTagFields(merged));
  }

  unset.genre_ids = "";
  unset.genres = "";

  if (!released) {
    if (doc.type === "movie") unset.release_date = "";
    else unset.first_air_date = "";
  }

  return { set, unset };
}

function hasAnyChanges(currentDoc, setPayload) {
  const keys = Object.keys(setPayload);
  for (const key of keys) {
    const next = setPayload[key];
    const current = currentDoc[key];
    if (JSON.stringify(next) !== JSON.stringify(current)) return true;
  }
  return false;
}

async function resolveOmdbForDoc(apiKey, doc) {
  const title = pickDocTitle(doc);
  if (!title) return { ok: false, reason: "missing_title" };

  const typeParam = doc.type === "movie" ? "movie" : "series";
  const year = pickDocYear(doc);
  const imdbId = typeof doc.imdb_id === "string" && doc.imdb_id.trim() ? doc.imdb_id.trim() : "";

  if (imdbId) {
    const byId = await fetchOmdb(apiKey, { i: imdbId, type: typeParam });
    if (byId?.Response === "True") return { ok: true, data: byId };
  }

  const byTitleYear = await fetchOmdb(apiKey, {
    t: title,
    type: typeParam,
    y: year || undefined,
  });
  if (byTitleYear?.Response === "True") return { ok: true, data: byTitleYear };

  const byTitleOnly = await fetchOmdb(apiKey, { t: title, type: typeParam });
  if (byTitleOnly?.Response === "True") return { ok: true, data: byTitleOnly };

  return { ok: false, reason: byTitleOnly?.Error || byTitleYear?.Error || "not_found" };
}

async function run() {
  loadEnvLocal();

  const imdbHelpers = await import("../src/lib/imdbGenres.js");

  const mongoUri = process.env.MONGODB_URI;
  const omdbApiKey = process.env.OMDB_API_KEY || process.env.NEXT_PUBLIC_OMDB_API_KEY;

  if (!mongoUri) throw new Error("MONGODB_URI is missing in .env.local");
  if (!omdbApiKey) throw new Error("OMDB_API_KEY is missing in .env.local");

  const typeArg = (argValue("--type", "all") || "all").toLowerCase();
  const validTypes = new Set(["all", "movie", "tv"]);
  if (!validTypes.has(typeArg)) {
    throw new Error("Invalid --type. Use: all | movie | tv");
  }

  const limit = Math.max(0, parseInt(argValue("--limit", "0"), 10) || 0);
  const skip = Math.max(0, parseInt(argValue("--skip", "0"), 10) || 0);
  const delayMs = Math.max(0, parseInt(argValue("--delay", "250"), 10) || 250);
  const dryRun = hasFlag("--dry-run");
  const includeAnime = hasFlag("--include-anime");
  const priorityRatings = !hasFlag("--no-priority-ratings");

  const typeFilter = typeArg === "all" ? ["movie", "tv"] : [typeArg];
  const query = {
    type: { $in: typeFilter },
  };
  if (!includeAnime) {
    query.$and = [
      {
        $or: [
          { is_anime: { $exists: false } },
          { is_anime: { $ne: true } },
          { source: { $ne: "jikan" } },
        ],
      },
    ];
  }

  if (priorityRatings) {
    const staleDays = Math.max(
      1,
      parseInt(argValue("--stale-days", "30"), 10) || 30
    );
    const staleCutoff = new Date();
    staleCutoff.setUTCDate(staleCutoff.getUTCDate() - staleDays);
    const staleIso = staleCutoff.toISOString();

    const needsRating = {
      $or: [
        { "omdb.imdbRating": { $exists: false } },
        { "omdb.imdbRating": null },
        { "omdb.imdbVotes": { $exists: false } },
        { "omdb.imdbVotes": null },
        { "omdb.ratingsUpdatedAt": { $exists: false } },
        { "omdb.ratingsUpdatedAt": { $lt: staleIso } },
      ],
    };
    query.$and = [...(query.$and ?? []), needsRating];
  }

  const client = new MongoClient(mongoUri);
  await client.connect();
  const db = client.db(DB_NAME);
  const collection = db.collection(COLLECTION);

  try {
    const totalMatching = await collection.countDocuments(query);
    const cursor = collection
      .find(query, {
        projection: {
          _id: 1,
          id: 1,
          type: 1,
          title: 1,
          name: 1,
          release_date: 1,
          first_air_date: 1,
          runtimeSeconds: 1,
          vote_average: 1,
          season_amount: 1,
          genre_ids: 1,
          overview: 1,
          imdb_id: 1,
          omdb: 1,
        },
      })
      .sort({ "omdb.ratingsUpdatedAt": 1, _id: 1 })
      .skip(skip);

    if (limit > 0) cursor.limit(limit);

    let scanned = 0;
    let matched = 0;
    let unchanged = 0;
    let updated = 0;
    let notFound = 0;
    let errors = 0;
    const ops = [];

    console.log(
      `start: total_matching=${totalMatching}, skip=${skip}, limit=${limit || "all"}, dry_run=${dryRun}, include_anime=${includeAnime}, priority_ratings=${priorityRatings}, delay_ms=${delayMs}`
    );

    for await (const doc of cursor) {
      scanned++;
      try {
        const resolved = await resolveOmdbForDoc(omdbApiKey, doc);
        if (!resolved.ok) {
          notFound++;
          if (scanned % 25 === 0) {
            console.log(
              `progress: scanned=${scanned}, matched=${matched}, updated=${updated}, unchanged=${unchanged}, not_found=${notFound}, errors=${errors}`
            );
          }
          await sleep(delayMs);
          continue;
        }

        matched++;
        const { set, unset } = buildSetPayload(doc, resolved.data, imdbHelpers);
        const hasSetChanges = hasAnyChanges(doc, set);
        const hasUnset = Object.keys(unset).length > 0;
        const shouldWrite = hasSetChanges || hasUnset;

        if (!shouldWrite) {
          unchanged++;
          if (scanned % 25 === 0) {
            console.log(
              `progress: scanned=${scanned}, matched=${matched}, updated=${updated}, unchanged=${unchanged}, not_found=${notFound}, errors=${errors}`
            );
          }
          await sleep(delayMs);
          continue;
        }

        if (!dryRun) {
          const updateDoc = { $set: set };
          if (hasUnset) updateDoc.$unset = unset;
          ops.push({
            updateOne: {
              filter: { _id: doc._id },
              update: updateDoc,
            },
          });
          if (ops.length >= 100) {
            await collection.bulkWrite(ops, { ordered: false });
            updated += ops.length;
            ops.length = 0;
          }
        } else {
          updated++;
        }
      } catch (err) {
        errors++;
        console.error(`error on _id=${String(doc._id)}: ${err.message}`);
      }

      if (scanned % 25 === 0) {
        console.log(
          `progress: scanned=${scanned}, matched=${matched}, updated=${updated}, unchanged=${unchanged}, not_found=${notFound}, errors=${errors}`
        );
      }
      await sleep(delayMs);
    }

    if (!dryRun && ops.length > 0) {
      await collection.bulkWrite(ops, { ordered: false });
      updated += ops.length;
    }

    console.log(
      `done: scanned=${scanned}, matched=${matched}, updated=${updated}, unchanged=${unchanged}, not_found=${notFound}, errors=${errors}, dry_run=${dryRun}`
    );
  } finally {
    await client.close();
  }
}

run().catch((err) => {
  console.error("update-content-from-omdb failed:", err.message);
  process.exit(1);
});

