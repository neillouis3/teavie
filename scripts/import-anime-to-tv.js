/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");

const JIKAN_BASE = "https://api.jikan.moe/v4/anime";
const ANILIST_GRAPHQL = "https://graphql.anilist.co";
const MAX_PAGES = 500;
const PAGE_DELAY_MS = 800;
const ANILIST_DELAY_MS = 120;
const FETCH_TIMEOUT_MS = 12000;
const OUTPUT_FILE = path.join(__dirname, "anime-tv-import.jsonl");

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function argValue(flag, fallback = null) {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return fallback;
  return process.argv[idx + 1] ?? fallback;
}

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

function parseRuntimeSeconds(duration) {
  if (typeof duration !== "string") return null;
  const h = /(\d+)\s*hr/i.exec(duration);
  const m = /(\d+)\s*min/i.exec(duration);
  const hours = h ? Number(h[1]) : 0;
  const mins = m ? Number(m[1]) : 0;
  const total = hours * 3600 + mins * 60;
  return total > 0 ? total : null;
}

function firstDate(aired) {
  const d = aired && typeof aired === "object" ? aired.from : null;
  if (typeof d !== "string" || !d) return null;
  // Keep YYYY-MM-DD for existing filter/sort behavior.
  return d.slice(0, 10);
}

function coerceVote(score) {
  if (typeof score !== "number" || Number.isNaN(score)) return null;
  return score;
}

function pickString(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function pickArrayStrings(values) {
  if (!Array.isArray(values)) return [];
  return values
    .map((v) => (typeof v === "string" ? v.trim() : ""))
    .filter(Boolean);
}

function pickLanguage(anime) {
  const title = String(anime?.title || anime?.title_japanese || "").trim();
  if (/[\u3040-\u30ff\u3400-\u9fbf]/.test(title)) return "ja";
  return "ja";
}

function toGenres(anime) {
  if (!Array.isArray(anime?.genres)) return [];
  return anime.genres
    .map((g) => {
      const id = Number(g?.mal_id);
      const name = typeof g?.name === "string" ? g.name : "";
      if (!Number.isFinite(id) || !name) return null;
      return { id, name };
    })
    .filter(Boolean);
}

const MAX_TITLE_ALIASES = 64;

/** All known title strings for search (JP/EN/romaji/synonyms). */
function buildTitleAliases(anime, anilist) {
  const set = new Set();
  const add = (s) => {
    const t = pickString(s);
    if (t) set.add(t);
  };
  add(anime?.title);
  add(anime?.title_english);
  add(anime?.title_japanese);
  if (anilist && typeof anilist === "object") {
    add(anilist?.title?.romaji);
    add(anilist?.title?.english);
    add(anilist?.title?.native);
    for (const s of pickArrayStrings(anilist?.synonyms)) add(s);
  }
  return [...set].slice(0, MAX_TITLE_ALIASES);
}

/** Prefer English / Latin title for cards; keep Japanese in `title_aliases`. */
function preferredAnimeDisplayTitle(anime, anilist, malId) {
  return (
    pickString(anilist?.title?.english) ||
    pickString(anime?.title_english) ||
    pickString(anime?.title) ||
    pickString(anilist?.title?.romaji) ||
    pickString(anime?.title_japanese) ||
    pickString(anilist?.title?.native) ||
    `Anime ${malId}`
  );
}

async function fetchJsonWithTimeout(url, init = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`HTTP ${res.status}: ${text.slice(0, 220)}`);
    }
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

async function fetchAniListByMalId(malId, cache) {
  const key = String(malId);
  if (cache.has(key)) return cache.get(key);
  const query = `
    query ($idMal: Int) {
      Media(idMal: $idMal, type: ANIME) {
        id
        idMal
        siteUrl
        title { romaji english native }
        coverImage { extraLarge large medium color }
        bannerImage
        episodes
        duration
        genres
        averageScore
        popularity
        season
        seasonYear
        format
        status
        isAdult
        synonyms
      }
    }
  `;

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const payload = await fetchJsonWithTimeout(ANILIST_GRAPHQL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          query,
          variables: { idMal: Number(malId) },
        }),
      });
      const media = payload?.data?.Media ?? null;
      cache.set(key, media);
      return media;
    } catch (err) {
      if (attempt === 3) {
        cache.set(key, null);
        return null;
      }
      await sleep(500 * attempt);
    }
  }
  cache.set(key, null);
  return null;
}

async function fetchAniListBySearch(anime, cache) {
  const title =
    pickString(anime?.title_english) ||
    pickString(anime?.title) ||
    pickString(anime?.title_japanese);
  if (!title) return null;
  const year = Number(String(firstDate(anime?.aired) || "").slice(0, 4)) || null;
  const key = `search:${title.toLowerCase()}|${year || ""}`;
  if (cache.has(key)) return cache.get(key);

  const query = `
    query ($search: String, $seasonYear: Int) {
      Page(page: 1, perPage: 5) {
        media(
          type: ANIME
          search: $search
          seasonYear: $seasonYear
          sort: [POPULARITY_DESC, SCORE_DESC]
        ) {
          id
          idMal
          siteUrl
          title { romaji english native }
          coverImage { extraLarge large medium color }
          bannerImage
          episodes
          duration
          genres
          averageScore
          popularity
          season
          seasonYear
          format
          status
          isAdult
          synonyms
        }
      }
    }
  `;

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const payload = await fetchJsonWithTimeout(ANILIST_GRAPHQL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          query,
          variables: { search: title, seasonYear: year || undefined },
        }),
      });
      const rows = payload?.data?.Page?.media;
      const media = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
      cache.set(key, media);
      return media;
    } catch {
      if (attempt === 3) {
        cache.set(key, null);
        return null;
      }
      await sleep(500 * attempt);
    }
  }
  cache.set(key, null);
  return null;
}

function mapAnimeToTvDoc(anime, anilist) {
  const malId = anime.mal_id;
  const anilistPoster =
    pickString(anilist?.coverImage?.extraLarge) ||
    pickString(anilist?.coverImage?.large) ||
    pickString(anilist?.coverImage?.medium);
  const anilistBackdrop = pickString(anilist?.bannerImage);
  const poster =
    anilistPoster ||
    anime?.images?.jpg?.large_image_url ||
    anime?.images?.jpg?.image_url ||
    anime?.images?.webp?.large_image_url ||
    anime?.images?.webp?.image_url ||
    null;

  const backdrop =
    anilistBackdrop ||
    anime?.trailer?.images?.maximum_image_url ||
    anime?.trailer?.images?.large_image_url ||
    anime?.trailer?.images?.medium_image_url ||
    poster;

  const genres = toGenres(anime);

  const tags = ["anime"];
  if (anime.type) tags.push(String(anime.type).toLowerCase());
  if (anime.rating) tags.push(String(anime.rating).toLowerCase());
  if (anilist?.format) tags.push(String(anilist.format).toLowerCase());
  if (anime.status) tags.push(String(anime.status).toLowerCase());

  const dedupedTags = [...new Set(tags)];
  const runtimeSeconds =
    parseRuntimeSeconds(anime.duration) ||
    (Number.isFinite(Number(anilist?.duration)) ? Number(anilist.duration) * 60 : null);
  const title = preferredAnimeDisplayTitle(anime, anilist, malId);
  const title_aliases = buildTitleAliases(anime, anilist);
  const anilistGenres = pickArrayStrings(anilist?.genres);

  return {
    // Keep `type: "tv"` so it lands in existing TV flows.
    type: "tv",
    // Use a namespaced id to avoid colliding with TMDB numeric ids.
    id: `anime_${malId}`,
    mal_id: malId,
    anilist_id: Number.isFinite(Number(anilist?.id)) ? Number(anilist.id) : null,
    anilist_mal_id: Number.isFinite(Number(anilist?.idMal)) ? Number(anilist.idMal) : malId,
    source: "jikan",
    is_anime: true,
    tags: dedupedTags,
    title,
    name: title,
    title_aliases,
    release_date: null,
    first_air_date: firstDate(anime.aired),
    poster_path: poster,
    backdrop_path: backdrop,
    overview: anime.synopsis || anime.background || null,
    runtimeSeconds,
    number_of_seasons: 1,
    season_amount: typeof anime.episodes === "number" ? anime.episodes : null,
    number_of_episodes: typeof anime.episodes === "number" ? anime.episodes : null,
    popularity: typeof anime.popularity === "number" ? anime.popularity : 0,
    vote_average: coerceVote(anime.score),
    rating: pickString(anime.rating),
    status: pickString(anime.status),
    original_language: pickLanguage(anime),
    origin_country: ["JP"],
    mal_genre_names: genres.map((g) => g?.name).filter(Boolean),
    tagline: pickString(anime.background),
    studios: Array.isArray(anime?.studios)
      ? anime.studios
          .map((s) => ({ id: Number(s?.mal_id), name: pickString(s?.name) }))
          .filter((s) => Number.isFinite(s.id) && s.name)
      : [],
    licensors: Array.isArray(anime?.licensors)
      ? anime.licensors
          .map((s) => ({ id: Number(s?.mal_id), name: pickString(s?.name) }))
          .filter((s) => Number.isFinite(s.id) && s.name)
      : [],
    producers: Array.isArray(anime?.producers)
      ? anime.producers
          .map((s) => ({ id: Number(s?.mal_id), name: pickString(s?.name) }))
          .filter((s) => Number.isFinite(s.id) && s.name)
      : [],
    external_ids: {
      anilist_id: Number.isFinite(Number(anilist?.id)) ? Number(anilist.id) : null,
      mal_id: malId,
    },
    anilist: anilist
      ? {
          id: Number.isFinite(Number(anilist.id)) ? Number(anilist.id) : null,
          idMal: Number.isFinite(Number(anilist.idMal)) ? Number(anilist.idMal) : null,
          siteUrl: pickString(anilist.siteUrl),
          season: pickString(anilist.season),
          seasonYear: Number.isFinite(Number(anilist.seasonYear)) ? Number(anilist.seasonYear) : null,
          format: pickString(anilist.format),
          status: pickString(anilist.status),
          isAdult: Boolean(anilist.isAdult),
          averageScore: Number.isFinite(Number(anilist.averageScore)) ? Number(anilist.averageScore) : null,
          popularity: Number.isFinite(Number(anilist.popularity)) ? Number(anilist.popularity) : null,
          episodes: Number.isFinite(Number(anilist.episodes)) ? Number(anilist.episodes) : null,
          duration: Number.isFinite(Number(anilist.duration)) ? Number(anilist.duration) : null,
          genres: anilistGenres,
          synonyms: pickArrayStrings(anilist.synonyms),
          title: {
            romaji: pickString(anilist?.title?.romaji),
            english: pickString(anilist?.title?.english),
            native: pickString(anilist?.title?.native),
          },
          coverImage: {
            extraLarge: pickString(anilist?.coverImage?.extraLarge),
            large: pickString(anilist?.coverImage?.large),
            medium: pickString(anilist?.coverImage?.medium),
            color: pickString(anilist?.coverImage?.color),
          },
          bannerImage: pickString(anilist.bannerImage),
        }
      : null,
  };
}

async function fetchJikanPage(page) {
  const url = new URL(JIKAN_BASE);
  url.searchParams.set("page", String(page));
  url.searchParams.set("limit", "25");
  url.searchParams.set("type", "tv");
  // Latest -> oldest by anime start date
  url.searchParams.set("order_by", "start_date");
  url.searchParams.set("sort", "desc");

  return fetchJsonWithTimeout(url.toString(), {
    headers: { Accept: "application/json" },
  });
}

async function run() {
  loadEnvLocal();
  const { applyImdbGenresToCatalogDoc } = await import("../src/lib/imdbGenres.js");
  const startPage = Math.max(1, parseInt(process.argv[2] || "1", 10));
  const maxPages = Math.max(1, parseInt(process.argv[3] || String(MAX_PAGES), 10));
  const resumeMode = process.argv.includes("--resume");
  const includeAniList = !process.argv.includes("--no-anilist");
  const pageDelayMs = Math.max(0, Number(argValue("--page-delay", String(PAGE_DELAY_MS))) || 0);
  const anilistDelayMs = Math.max(
    0,
    Number(argValue("--anilist-delay", String(ANILIST_DELAY_MS))) || 0
  );
  let scanned = 0;
  let skippedExisting = 0;
  let withAniList = 0;
  let withoutAniList = 0;
  let anilistFromSearch = 0;
  const anilistCache = new Map();

  // Default behavior: start from beginning (truncate output file).
  // Use --resume to keep existing lines and skip duplicate mal_id values.
  if (!resumeMode) {
    fs.writeFileSync(OUTPUT_FILE, "");
  } else if (!fs.existsSync(OUTPUT_FILE)) {
    fs.writeFileSync(OUTPUT_FILE, "");
  }
  const existing = new Set();
  if (resumeMode) {
    const existingRaw = fs.readFileSync(OUTPUT_FILE, "utf8");
    for (const line of existingRaw.split("\n")) {
      const t = line.trim();
      if (!t) continue;
      try {
        const obj = JSON.parse(t);
        if (obj && typeof obj === "object" && obj.mal_id != null) {
          existing.add(String(obj.mal_id));
        }
      } catch {
        // ignore malformed lines; keep streaming new entries
      }
    }
  }

  for (let page = startPage; page < startPage + maxPages; page++) {
    const payload = await fetchJikanPage(page);
    const rows = Array.isArray(payload?.data) ? payload.data : [];
    if (!rows.length) break;

    let appendedThisPage = 0;
    const pageBuffer = [];
    for (const anime of rows) {
      const malId = anime?.mal_id;
      if (!malId) continue;
      if (existing.has(String(malId))) {
        skippedExisting++;
        continue;
      }

      let anilist = includeAniList ? await fetchAniListByMalId(malId, anilistCache) : null;
      if (!anilist && includeAniList) {
        anilist = await fetchAniListBySearch(anime, anilistCache);
        if (anilist?.id != null) anilistFromSearch++;
      }
      if (anilist?.id != null) withAniList++;
      else if (includeAniList) withoutAniList++;
      const doc = applyImdbGenresToCatalogDoc(mapAnimeToTvDoc(anime, anilist));
      pageBuffer.push(JSON.stringify(doc));
      existing.add(String(malId));
      scanned++;
      appendedThisPage++;
      if (includeAniList && anilistDelayMs > 0) await sleep(anilistDelayMs);
    }

    // Stream writes per Jikan page (up to 25 entries) instead of waiting for full run.
    if (pageBuffer.length > 0) {
      fs.appendFileSync(OUTPUT_FILE, `${pageBuffer.join("\n")}\n`);
    }

    const hasNext = Boolean(payload?.pagination?.has_next_page);
    console.log(
      `page ${page}: fetched=${rows.length}, appended=${appendedThisPage}, total_appended=${scanned}, skipped_existing=${skippedExisting}, anilist_found=${withAniList}, anilist_search_hit=${anilistFromSearch}, anilist_missing=${withoutAniList}`
    );
    if (!hasNext) break;
    if (pageDelayMs > 0) await sleep(pageDelayMs);
  }

  console.log(
    `done: appended=${scanned}, skipped_existing=${skippedExisting}, anilist_found=${withAniList}, anilist_search_hit=${anilistFromSearch}, anilist_missing=${withoutAniList}, resume=${resumeMode}, order=start_date_desc, page_delay_ms=${pageDelayMs}, anilist_delay_ms=${anilistDelayMs}, output=${OUTPUT_FILE}`
  );
}

run().catch((err) => {
  console.error("import-anime-to-tv failed:", err.message);
  process.exit(1);
});

