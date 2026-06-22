/**
 * Fill empty `imdb_genres` by fetching genres from TMDB (find by IMDb id, detail, search).
 *
 *   node scripts/fill-missing-imdb-genres.mjs
 *   node scripts/fill-missing-imdb-genres.mjs --dry-run
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { MongoClient } from "mongodb";
import { tmdbBearerToken } from "../src/lib/tmdbAuth.js";
import { omdbApiKey } from "../src/lib/omdbAuth.js";
import { applyImdbGenresToCatalogDoc } from "../src/lib/imdbGenres.js";

const require = createRequire(import.meta.url);
const { loadMongoEnv, mongoHostHint } = require(path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "lib/mongoEnv.cjs"
));

const DB_NAME = "teavie";
const COLLECTION = "content";
const TMDB_BASE = "https://api.themoviedb.org/3";
const OMDB_BASE = "https://www.omdbapi.com/";
const SLEEP_MS = 45;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function hasFlag(flag) {
  return process.argv.includes(flag);
}

function missingGenresQuery() {
  return {
    $and: [
      { type: { $in: ["movie", "tv"] } },
      {
        $or: [
          { imdb_genres: { $exists: false } },
          { imdb_genres: null },
          { imdb_genres: { $size: 0 } },
        ],
      },
    ],
  };
}

function docTitle(doc) {
  return String(doc.title ?? doc.name ?? "").trim();
}

function docYear(doc) {
  const raw =
    doc.type === "movie"
      ? doc.release_date ?? doc.releaseDate
      : doc.first_air_date ?? doc.firstAirDate;
  const s = String(raw ?? "").trim();
  return /^\d{4}/.test(s) ? s.slice(0, 4) : "";
}

function tmdbIdFromDoc(doc) {
  const fromField =
    typeof doc.tmdb_id === "number"
      ? doc.tmdb_id
      : typeof doc.tmdb_id === "string"
        ? Number(doc.tmdb_id)
        : NaN;
  if (Number.isFinite(fromField) && fromField > 0) return fromField;
  const idNum = typeof doc.id === "number" ? doc.id : Number(doc.id);
  if (Number.isFinite(idNum) && idNum > 0 && !String(doc.id).startsWith("anime_")) {
    return idNum;
  }
  return null;
}

function genrePayloadFromTmdbJson(data) {
  if (!data || typeof data !== "object") return null;
  const genres = Array.isArray(data.genres) ? data.genres : [];
  let genre_ids = Array.isArray(data.genre_ids)
    ? data.genre_ids
    : genres.map((g) => g.id).filter((id) => Number.isFinite(id));
  if (genres.length === 0 && genre_ids.length === 0) return null;
  if (genres.length === 0 && genre_ids.length > 0) {
    return { genres: [], genre_ids };
  }
  return { genres, genre_ids };
}

async function tmdbGet(pathWithQuery, token) {
  const url = pathWithQuery.startsWith("http")
    ? pathWithQuery
    : `${TMDB_BASE}${pathWithQuery}`;
  const res = await fetch(url, {
    headers: {
      accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
  });
  if (!res.ok) return null;
  return res.json();
}

async function fetchTmdbDetailGenres(doc, token) {
  const id = tmdbIdFromDoc(doc);
  if (id == null) return null;
  const segment = doc.type === "movie" ? "movie" : "tv";
  const data = await tmdbGet(`/${segment}/${id}?language=en-US`, token);
  return genrePayloadFromTmdbJson(data);
}

async function fetchTmdbFindByImdb(imdbId, type, token) {
  if (!imdbId || !/^tt\d+$/i.test(imdbId)) return null;
  const data = await tmdbGet(
    `/find/${imdbId}?external_source=imdb_id&language=en-US`,
    token
  );
  if (!data) return null;
  const list =
    type === "movie"
      ? data.movie_results
      : data.tv_results?.length
        ? data.tv_results
        : data.movie_results;
  const hit = Array.isArray(list) ? list[0] : null;
  if (!hit?.id) return null;
  const segment =
    type === "movie" || (data.movie_results?.length && !data.tv_results?.length)
      ? "movie"
      : "tv";
  const detail = await tmdbGet(`/${segment}/${hit.id}?language=en-US`, token);
  const payload = genrePayloadFromTmdbJson(detail ?? hit);
  return payload ? { ...payload, tmdb_id: hit.id } : null;
}

async function fetchTmdbSearchGenres(doc, token) {
  const title = docTitle(doc);
  if (title.length < 2) return null;
  const segment = doc.type === "movie" ? "movie" : "tv";
  const q = new URLSearchParams({
    query: title,
    include_adult: "false",
    language: "en-US",
  });
  const year = docYear(doc);
  if (year) q.set("year", year);
  const data = await tmdbGet(`/search/${segment}?${q}`, token);
  const results = Array.isArray(data?.results) ? data.results : [];
  for (const hit of results.slice(0, 3)) {
    if (!hit?.id) continue;
    const fromList = genrePayloadFromTmdbJson(hit);
    if (fromList) return { ...fromList, tmdb_id: hit.id };
    const detail = await tmdbGet(`/${segment}/${hit.id}?language=en-US`, token);
    const payload = genrePayloadFromTmdbJson(detail ?? hit);
    if (payload) return { ...payload, tmdb_id: hit.id };
    await sleep(SLEEP_MS);
  }
  return null;
}

async function fetchOmdbGenreRaw(imdbId, type, apiKey) {
  if (!imdbId || !apiKey) return null;
  const url = new URL(OMDB_BASE);
  url.searchParams.set("apikey", apiKey);
  url.searchParams.set("i", imdbId);
  url.searchParams.set("type", type === "movie" ? "movie" : "series");
  url.searchParams.set("r", "json");
  const res = await fetch(url.toString(), { headers: { Accept: "application/json" } });
  if (!res.ok) return null;
  const data = await res.json();
  if (data?.Response !== "True") return null;
  const genre = data.Genre;
  if (typeof genre !== "string" || genre === "N/A") return null;
  return genre;
}

function titleGenreHints(doc) {
  const title = docTitle(doc).toLowerCase();
  const hints = [];
  if (/documentary|docuseries|true crime|unredacted story|reel\?|reel$/.test(title)) {
    hints.push("Documentary");
  }
  if (/comedy|stand.?up|funny/.test(title)) hints.push("Comedy");
  if (/horror| haunted |exorcist|devil|zombie|vampire|fallen|apollo has/.test(title)) {
    hints.push("Horror");
    hints.push("Action");
  }
  if (/kingsman|007|bond|mission impossible|fast & furious|marvel|batman|superman|avengers|shang-chi|sherlock|lucy|star wars|jurassic|terminator|matrix|rambo|rocky|john wick|expendables|equalizer/.test(title)) {
    hints.push("Action");
    hints.push("Adventure");
  }
  if (/romance| valentine|love story|wedding/.test(title)) hints.push("Romance");
  if (/mystery|detective| sherlock |clue|whodunit/.test(title)) hints.push("Mystery");
  if (/crime|criminal|heist|robbery|gangster|mob | mafia/.test(title)) {
    hints.push("Crime");
  }
  if (/sci-fi|space|galaxy|alien|cyber|future|time travel|wreckage of time/.test(title)) {
    hints.push("Sci-Fi");
  }
  if (/animation|animated|cartoon/.test(title)) hints.push("Animation");
  if (/musical|concert|singer|band tour/.test(title)) hints.push("Music");
  if (/sport|championship|olympic|nba|nfl|fifa/.test(title)) hints.push("Sport");
  if (/war|battle|soldier|military|combat/.test(title)) hints.push("War");
  if (/fantasy|dragon|wizard|magic kingdom|enchanted/.test(title)) hints.push("Fantasy");
  if (/western|cowboy|frontier/.test(title)) hints.push("Western");
  if (/biopic|biography|life of /.test(title)) hints.push("Biography");
  if (/newsnight|news night|nightly news|evening news/.test(title)) hints.push("News");
  if (/tonight show|late night|talk show|consequences|entertainment tonight/.test(title)) {
    hints.push("Talk-Show");
  }
  if (/reality|bachelor|baddies|wildcard kitchen/.test(title)) hints.push("Reality-TV");
  if (/sex criminals|pasila|swingers/.test(title)) hints.push("Comedy");
  if (/phototherapy|filmé|filmed by|documentaire|docu/.test(title)) {
    hints.push("Documentary");
  }
  if (/映画|eiga/.test(title)) hints.push("Drama");
  if (/joust|tournament|medieval/.test(title)) hints.push("Action", "History");
  if (/zoo|mungchi|boyuna|dëmm|geheugen|ndobine|incasable|lof joe|dobine/.test(title)) {
    hints.push("Drama");
  }
  return [...new Set(hints)];
}

async function fetchFranchiseGenres(doc, token) {
  const title = docTitle(doc);
  let base = title.split(/[:–—-]/)[0].trim();
  base = base.replace(/\s+(2|3|4|5|part\s+\d+|season\s+\d+)$/i, "").trim();
  if (base.length < 3) return null;

  const segment = doc.type === "movie" ? "movie" : "tv";
  const q = new URLSearchParams({
    query: base,
    include_adult: "false",
    language: "en-US",
  });
  const data = await tmdbGet(`/search/${segment}?${q}`, token);
  const results = Array.isArray(data?.results) ? data.results : [];

  for (const hit of results.slice(0, 5)) {
    if (!hit?.id) continue;
    const detail = await tmdbGet(`/${segment}/${hit.id}?language=en-US`, token);
    const payload = genrePayloadFromTmdbJson(detail ?? hit);
    if (payload) return { ...payload, tmdb_id: hit.id };
  }
  return null;
}

async function fetchAggressiveFranchiseGenres(doc, token) {
  const words = docTitle(doc)
    .replace(/[:–—-].*$/, "")
    .split(/\s+/)
    .map((w) => w.replace(/[^a-z0-9']/gi, ""))
    .filter(
      (w) =>
        w.length >= 4 &&
        !/^(the|and|part|season|story|tales|chapter|volume|from|with|into|over)$/i.test(
          w
        )
    );
  for (const word of [...new Set(words)]) {
    const hit = await fetchFranchiseGenres(
      { ...doc, title: word, name: word },
      token
    );
    if (hit) return hit;
    await sleep(SLEEP_MS);
  }
  return null;
}

async function enrichDocGenres(doc, token, omdbKey) {
  /** @type {Record<string, unknown>} */
  let enriched = { ...doc };
  const imdbId =
    typeof doc.imdb_id === "string" && /^tt/i.test(doc.imdb_id)
      ? doc.imdb_id.trim()
      : "";

  if (omdbKey && imdbId) {
    const genreRaw = await fetchOmdbGenreRaw(imdbId, doc.type, omdbKey);
    if (genreRaw) {
      enriched = {
        ...enriched,
        omdb: { ...(doc.omdb ?? {}), genre: genreRaw },
      };
    }
    await sleep(120);
  }

  let normalized = applyImdbGenresToCatalogDoc(enriched);
  if (normalized.imdb_genres?.length) return { normalized, enriched };

  if (imdbId) {
    const found = await fetchTmdbFindByImdb(imdbId, doc.type, token);
    if (found) {
      enriched = { ...enriched, ...found };
      normalized = applyImdbGenresToCatalogDoc(enriched);
      if (normalized.imdb_genres?.length) return { normalized, enriched };
    }
    await sleep(SLEEP_MS);
  }

  const detail = await fetchTmdbDetailGenres(doc, token);
  if (detail) {
    enriched = { ...enriched, ...detail };
    normalized = applyImdbGenresToCatalogDoc(enriched);
    if (normalized.imdb_genres?.length) return { normalized, enriched };
  }
  await sleep(SLEEP_MS);

  const searched = await fetchTmdbSearchGenres(doc, token);
  if (searched) {
    enriched = { ...enriched, ...searched };
    normalized = applyImdbGenresToCatalogDoc(enriched);
    if (normalized.imdb_genres?.length) return { normalized, enriched };
  }
  await sleep(SLEEP_MS);

  const franchise = await fetchFranchiseGenres(doc, token);
  if (franchise) {
    enriched = { ...enriched, ...franchise };
    normalized = applyImdbGenresToCatalogDoc(enriched);
    if (normalized.imdb_genres?.length) return { normalized, enriched };
  }
  await sleep(SLEEP_MS);

  const aggressive = await fetchAggressiveFranchiseGenres(doc, token);
  if (aggressive) {
    enriched = { ...enriched, ...aggressive };
    normalized = applyImdbGenresToCatalogDoc(enriched);
    if (normalized.imdb_genres?.length) return { normalized, enriched };
  }
  await sleep(SLEEP_MS);

  const hints = titleGenreHints(doc);
  if (hints.length) {
    enriched = { ...enriched, imdb_genres: hints };
    normalized = applyImdbGenresToCatalogDoc(enriched);
    if (normalized.imdb_genres?.length) return { normalized, enriched };
  }

  return { normalized: applyImdbGenresToCatalogDoc(doc), enriched: doc };
}

async function main() {
  loadMongoEnv();
  const dryRun = hasFlag("--dry-run");

  const uri = String(process.env.MONGODB_URI ?? "").trim();
  const token = tmdbBearerToken().trim();
  const omdbKey = omdbApiKey();

  if (!uri) {
    console.error("Missing MONGODB_URI");
    process.exit(1);
  }
  if (!token) {
    console.error("Missing TMDB_BEARER");
    process.exit(1);
  }

  console.log(
    `fill missing imdb genres | mongo=${mongoHostHint(uri)} dryRun=${dryRun} omdb=${omdbKey ? "yes" : "no"}`
  );

  const client = new MongoClient(uri);
  await client.connect();
  const col = client.db(DB_NAME).collection(COLLECTION);

  const cursor = col.find(missingGenresQuery(), {
    projection: {
      type: 1,
      id: 1,
      tmdb_id: 1,
      imdb_id: 1,
      title: 1,
      name: 1,
      omdb: 1,
      release_date: 1,
      first_air_date: 1,
      origin_country: 1,
      original_language: 1,
      is_anime: 1,
      catalog_categories: 1,
      anilist: 1,
    },
  });

  let scanned = 0;
  let filled = 0;
  let stillEmpty = 0;
  let errors = 0;
  const ops = [];

  for await (const doc of cursor) {
    scanned += 1;
    try {
      const { normalized, enriched } = await enrichDocGenres(doc, token, omdbKey);
      const imdb_genres = normalized.imdb_genres ?? [];
      if (!imdb_genres.length) {
        stillEmpty += 1;
        continue;
      }

      /** @type {Record<string, unknown>} */
      const set = { imdb_genres };
      if (normalized.is_kdrama === true) {
        set.is_kdrama = true;
        set.catalog_categories = normalized.catalog_categories;
      }
      if (enriched.omdb?.genre && !doc.omdb?.genre) {
        set.omdb = enriched.omdb;
      }
      if (enriched.tmdb_id && !doc.tmdb_id) {
        set.tmdb_id = enriched.tmdb_id;
      }

      if (!dryRun) {
        ops.push({
          updateOne: {
            filter: { _id: doc._id },
            update: { $set: set },
          },
        });
        if (ops.length >= 100) {
          await col.bulkWrite(ops, { ordered: false });
          ops.length = 0;
        }
      }
      filled += 1;
    } catch (e) {
      errors += 1;
      console.warn(
        `doc ${doc.id}: ${e instanceof Error ? e.message : String(e)}`
      );
    }

    if (scanned % 25 === 0) {
      console.log(`progress scanned=${scanned} filled=${filled} empty=${stillEmpty}`);
    }
  }

  if (!dryRun && ops.length > 0) {
    await col.bulkWrite(ops, { ordered: false });
  }

  const remaining = await col.countDocuments(missingGenresQuery());
  const withImdb = await col.countDocuments({
    imdb_genres: { $exists: true, $ne: [] },
  });
  console.log(
    `done: scanned=${scanned} filled=${filled} still_empty=${stillEmpty} errors=${errors} remaining=${remaining} catalog_with_genres=${withImdb}`
  );
  await client.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
