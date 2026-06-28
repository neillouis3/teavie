/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");
const { MongoClient } = require("mongodb");

const DB_NAME = "teavie";
const COLLECTION = "content";
const DEFAULT_INPUT_FILE = path.join(__dirname, "anime-tv-import.jsonl");
const DEFAULT_KOMETA_FILE = path.join(__dirname, "anime-ids.json");
const DEFAULT_BULK_BATCH = 200;

function loadEnvLocal() {
  const { loadMongoEnv } = require("./lib/mongoEnv.cjs");
  loadMongoEnv();
}

function argValue(flag, fallback = null) {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return fallback;
  return process.argv[idx + 1] ?? fallback;
}

function parseMaybeNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function parseIntArg(flag, fallback) {
  const raw = argValue(flag, String(fallback));
  const n = parseInt(String(raw), 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function splitIds(value) {
  if (value == null) return [];
  const raw = String(value)
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
  const seen = new Set();
  const out = [];
  for (const item of raw) {
    if (!seen.has(item)) {
      seen.add(item);
      out.push(item);
    }
  }
  return out;
}

function toSingleNumberOrNull(value) {
  const parts = splitIds(value);
  if (!parts.length) return null;
  const n = parseMaybeNumber(parts[0]);
  return n;
}

function toSingleStringOrNull(value) {
  const parts = splitIds(value);
  return parts.length ? parts[0] : null;
}

function loadKometaMap(filePath) {
  if (!fs.existsSync(filePath)) return null;
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function buildKometaIndexes(kometaMap) {
  const byMal = new Map();
  const byAniList = new Map();
  const byTmdbShow = new Map();
  const byImdb = new Map();

  for (const [anidbId, raw] of Object.entries(kometaMap || {})) {
    if (!raw || typeof raw !== "object") continue;
    const entry = { anidb_id: parseMaybeNumber(anidbId), ...raw };

    for (const mal of splitIds(raw.mal_id)) {
      const n = parseMaybeNumber(mal);
      if (n != null && !byMal.has(n)) byMal.set(n, entry);
    }
    for (const ani of splitIds(raw.anilist_id)) {
      const n = parseMaybeNumber(ani);
      if (n != null && !byAniList.has(n)) byAniList.set(n, entry);
    }
    const tmdbShow = parseMaybeNumber(raw.tmdb_show_id);
    if (tmdbShow != null && !byTmdbShow.has(tmdbShow)) byTmdbShow.set(tmdbShow, entry);
    for (const imdb of splitIds(raw.imdb_id)) {
      if (imdb && !byImdb.has(imdb)) byImdb.set(imdb, entry);
    }
  }

  return { byMal, byAniList, byTmdbShow, byImdb };
}

function mergeKometaIds(doc, kometaEntry) {
  if (!kometaEntry) return doc;
  const next = { ...doc };
  const tvdbId = parseMaybeNumber(kometaEntry.tvdb_id);
  const tmdbShowId = parseMaybeNumber(kometaEntry.tmdb_show_id);
  const tmdbMovieId = parseMaybeNumber(kometaEntry.tmdb_movie_id);
  const malId = toSingleNumberOrNull(kometaEntry.mal_id);
  const anilistId = toSingleNumberOrNull(kometaEntry.anilist_id);
  const imdbId = toSingleStringOrNull(kometaEntry.imdb_id);

  if (tvdbId != null) next.tvdb_id = tvdbId;
  if (imdbId) next.imdb_id = imdbId;
  if (malId != null) next.mal_id = malId;
  if (anilistId != null) next.anilist_id = anilistId;
  if (tmdbShowId != null) next.tmdb_id = tmdbShowId;
  if (tmdbMovieId != null) next.tmdb_movie_id = tmdbMovieId;
  if (tmdbShowId != null) next.tmdb_show_id = tmdbShowId;

  next.external_ids = {
    ...(next.external_ids && typeof next.external_ids === "object" ? next.external_ids : {}),
    tvdb_id: tvdbId,
    imdb_id: imdbId,
    mal_id: malId,
    anilist_id: anilistId,
    tmdb_show_id: tmdbShowId,
    tmdb_movie_id: tmdbMovieId,
    anidb_id: kometaEntry.anidb_id ?? null,
  };
  return next;
}

function ensureAnimeFields(doc) {
  const next = { ...doc };
  next.type = "tv";
  next.is_anime = true;
  next.source = next.source || "jikan+kometa";
  const tags = Array.isArray(next.tags) ? next.tags : [];
  next.tags = [...new Set([...tags, "anime"])];
  return next;
}

function readJsonl(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Input file not found: ${filePath}`);
  }
  const lines = fs.readFileSync(filePath, "utf8").split("\n");
  const out = [];
  for (const line of lines) {
    const t = line.trim();
    if (!t) continue;
    try {
      const obj = JSON.parse(t);
      if (obj && typeof obj === "object") out.push(obj);
    } catch {
      // ignore malformed line
    }
  }
  return out;
}

async function run() {
  loadEnvLocal();
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is missing in .env.local");
  const kometaFile = argValue("--kometa-file", DEFAULT_KOMETA_FILE);
  const inputFile = argValue("--input", DEFAULT_INPUT_FILE);
  const batchSize = parseIntArg("--batch", DEFAULT_BULK_BATCH);
  const kometaMap = loadKometaMap(kometaFile);
  const kometaIndexes = buildKometaIndexes(kometaMap || {});

  const incomingRaw = readJsonl(inputFile);
  if (!incomingRaw.length) {
    console.log("No records found in JSONL.");
    return;
  }

  const client = new MongoClient(uri);
  await client.connect();

  const db = client.db(DB_NAME);
  const collection = db.collection(COLLECTION);

  try {
    let kometaMatched = 0;
    let upserted = 0;
    let modified = 0;
    let matched = 0;
    const ops = [];

    for (const raw of incomingRaw) {
      let doc = ensureAnimeFields(raw);
      const malId = parseMaybeNumber(doc.mal_id);
      const anilistId = parseMaybeNumber(doc.anilist_id);
      const tmdbId = parseMaybeNumber(doc.tmdb_id);
      const imdbId = typeof doc.imdb_id === "string" ? doc.imdb_id : null;

      const kometaEntry =
        (malId != null ? kometaIndexes.byMal.get(malId) : null) ||
        (anilistId != null ? kometaIndexes.byAniList.get(anilistId) : null) ||
        (tmdbId != null ? kometaIndexes.byTmdbShow.get(tmdbId) : null) ||
        (imdbId ? kometaIndexes.byImdb.get(imdbId) : null) ||
        null;

      if (kometaEntry) {
        kometaMatched++;
        doc = mergeKometaIds(doc, kometaEntry);
      }

      const matchClauses = [{ id: doc.id }];
      if (doc.mal_id != null) matchClauses.push({ mal_id: doc.mal_id });
      if (doc.anilist_id != null) matchClauses.push({ anilist_id: doc.anilist_id });
      if (doc.tmdb_id != null) matchClauses.push({ tmdb_id: doc.tmdb_id });
      if (doc.imdb_id) matchClauses.push({ imdb_id: doc.imdb_id });

      const payload = { ...doc, updated_at: new Date().toISOString() };
      ops.push({
        updateOne: {
          filter: { type: "tv", $or: matchClauses },
          update: { $set: payload },
          upsert: true,
        },
      });
    }

    for (let i = 0; i < ops.length; i += batchSize) {
      const chunk = ops.slice(i, i + batchSize);
      const result = await collection.bulkWrite(chunk, { ordered: false });
      upserted += result.upsertedCount;
      modified += result.modifiedCount;
      matched += result.matchedCount;
      const done = Math.min(i + chunk.length, ops.length);
      console.log(
        `bulk ${done}/${ops.length}: upserted+=${result.upsertedCount}, modified+=${result.modifiedCount}, matched+=${result.matchedCount}`
      );
    }

    console.log(
      `done: input=${incomingRaw.length}, upserted_new=${upserted}, modified=${modified}, matched_total=${matched}, kometa_row_hits=${kometaMatched}, batch=${batchSize}, kometa_file=${kometaMap ? kometaFile : "not_found"}, db=${DB_NAME}.${COLLECTION}`
    );
  } finally {
    await client.close();
  }
}

run().catch((err) => {
  console.error("import-anime-jsonl-to-mongo failed:", err.message);
  process.exit(1);
});

