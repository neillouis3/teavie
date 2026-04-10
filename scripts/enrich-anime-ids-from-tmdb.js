/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");
const { MongoClient } = require("mongodb");

const DB_NAME = "teavie";
const COLLECTION = "content";
const TMDB_SEARCH_URL = "https://api.themoviedb.org/3/search/tv";
const TMDB_EXTERNAL_IDS_URL = "https://api.themoviedb.org/3/tv";
const FETCH_TIMEOUT_MS = 12000;

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

function parseIntArg(flag, fallback) {
  const raw = argValue(flag, String(fallback));
  const n = parseInt(String(raw), 10);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeText(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function getYear(value) {
  if (typeof value !== "string") return null;
  const m = /^(\d{4})/.exec(value);
  return m ? Number(m[1]) : null;
}

function similarityScore(docTitle, docYear, candidate) {
  const cTitle = candidate?.name || candidate?.original_name || "";
  const cYear = getYear(candidate?.first_air_date || "");
  const nDoc = normalizeText(docTitle);
  const nCand = normalizeText(cTitle);

  let score = 0;
  if (nDoc && nCand) {
    if (nDoc === nCand) score += 80;
    else if (nCand.includes(nDoc) || nDoc.includes(nCand)) score += 60;
  }
  if (docYear != null && cYear != null) {
    const diff = Math.abs(docYear - cYear);
    if (diff === 0) score += 20;
    else if (diff <= 1) score += 12;
    else if (diff <= 2) score += 6;
  }
  score += Number(candidate?.popularity || 0) / 1000;
  return score;
}

async function tmdbFetch(url, token) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  const res = await fetch(url, {
    signal: controller.signal,
    headers: {
      accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
  }).finally(() => clearTimeout(timer));
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`TMDB ${res.status}: ${t.slice(0, 160)}`);
  }
  return res.json();
}

async function findBestTmdbTv(doc, token, useJikanTitles) {
  const primaryTitle = String(doc.title || doc.name || "").trim();
  if (!primaryTitle) return null;
  const year = getYear(doc.first_air_date || "");
  const titleCandidates = [primaryTitle];
  if (useJikanTitles) {
    // Optional path kept for future use; disabled by default to avoid Jikan rate limits.
  }

  const seen = new Set();
  const dedupedCandidates = titleCandidates.filter((t) => {
    const n = normalizeText(t);
    if (!n || seen.has(n)) return false;
    seen.add(n);
    return true;
  });

  let bestOverall = null;

  for (const title of dedupedCandidates) {
    const searchUrl = new URL(TMDB_SEARCH_URL);
    searchUrl.searchParams.set("query", title);
    searchUrl.searchParams.set("include_adult", "false");
    searchUrl.searchParams.set("language", "en-US");
    searchUrl.searchParams.set("page", "1");
    if (year != null) searchUrl.searchParams.set("first_air_date_year", String(year));

    const payload = await tmdbFetch(searchUrl.toString(), token);
    const results = Array.isArray(payload?.results) ? payload.results : [];
    if (!results.length) continue;

    const ranked = results
      .map((row) => ({ row, score: similarityScore(primaryTitle, year, row) }))
      .sort((a, b) => b.score - a.score);
    const best = ranked[0];
    if (!best) continue;
    if (!bestOverall || best.score > bestOverall.score) {
      bestOverall = best;
    }
  }

  if (!bestOverall || bestOverall.score < 45) return null;
  return bestOverall.row;
}

async function fetchExternalIds(tmdbId, token) {
  const url = `${TMDB_EXTERNAL_IDS_URL}/${tmdbId}/external_ids`;
  const payload = await tmdbFetch(url, token);
  const imdbId = typeof payload?.imdb_id === "string" ? payload.imdb_id : null;
  return { imdbId };
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function run() {
  loadEnvLocal();
  const mongoUri = process.env.MONGODB_URI;
  const tmdbToken = process.env.TMDB_BEARER || process.env.NEXT_PUBLIC_TMDB_BEARER;
  if (!mongoUri) throw new Error("MONGODB_URI missing in .env.local");
  if (!tmdbToken) throw new Error("TMDB_BEARER missing in .env.local");

  const limit = Math.max(0, parseIntArg("--limit", 0));
  const skip = Math.max(0, parseIntArg("--skip", 0));
  const delayMs = Math.max(0, parseIntArg("--delay", 250));
  const dryRun = hasFlag("--dry-run");
  const onlyId = argValue("--id", "").trim();
  const useJikanTitles = hasFlag("--use-jikan-titles");

  const client = new MongoClient(mongoUri);
  await client.connect();
  const db = client.db(DB_NAME);
  const collection = db.collection(COLLECTION);

  try {
    const query = {
      type: "tv",
      $or: [{ is_anime: true }, { tags: "anime" }, { source: "jikan" }],
    };
    if (onlyId) query.id = onlyId;
    const total = await collection.countDocuments(query);
    const cursor = collection
      .find(query, {
        projection: {
          _id: 1,
          id: 1,
          mal_id: 1,
          title: 1,
          name: 1,
          first_air_date: 1,
          tmdb_id: 1,
          imdb_id: 1,
          poster_path: 1,
          backdrop_path: 1,
        },
      })
      .sort({ _id: 1 })
      .skip(skip);

    if (limit > 0) cursor.limit(limit);

    let scanned = 0;
    let matched = 0;
    let updated = 0;
    let noMatch = 0;
    let errors = 0;

    console.log(
      `start: total=${total}, skip=${skip}, limit=${limit || "all"}, dry_run=${dryRun}, delay_ms=${delayMs}`
    );

    for await (const doc of cursor) {
      scanned++;
      try {
        const selected = await findBestTmdbTv(doc, tmdbToken, useJikanTitles);
        if (!selected || selected.id == null) {
          noMatch++;
          await sleep(delayMs);
          continue;
        }
        matched++;

        const ext = await fetchExternalIds(selected.id, tmdbToken);
        const nextTmdbId = Number(selected.id);
        const nextImdbId = ext.imdbId || null;
        const nextPoster = selected.poster_path || null;
        const nextBackdrop = selected.backdrop_path || selected.poster_path || null;

        const setPayload = {
          tmdb_id: nextTmdbId,
          imdb_id: nextImdbId,
          poster_path: nextPoster,
          backdrop_path: nextBackdrop,
          source: "tmdb+jikan",
          last_enriched_at: new Date().toISOString(),
        };

        const changed =
          Number(doc.tmdb_id) !== nextTmdbId ||
          (doc.imdb_id || null) !== nextImdbId ||
          (doc.poster_path || null) !== nextPoster ||
          (doc.backdrop_path || null) !== nextBackdrop;

        if (changed) {
          updated++;
          if (!dryRun) {
            await collection.updateOne({ _id: doc._id }, { $set: setPayload });
          }
        }
      } catch (err) {
        errors++;
        console.error(`error: id=${String(doc.id)} mal_id=${String(doc.mal_id || "")} ${err.message}`);
      }

      if (scanned % 25 === 0) {
        console.log(
          `progress: scanned=${scanned}, matched=${matched}, updated=${updated}, no_match=${noMatch}, errors=${errors}`
        );
      }
      await sleep(delayMs);
    }

    console.log(
      `done: scanned=${scanned}, matched=${matched}, updated=${updated}, no_match=${noMatch}, errors=${errors}, dry_run=${dryRun}`
    );
  } finally {
    await client.close();
  }
}

run().catch((err) => {
  console.error("enrich-anime-ids-from-tmdb failed:", err.message);
  process.exit(1);
});

