/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");

const JIKAN_BASE = "https://api.jikan.moe/v4/anime";
const MAX_PAGES = 500;
const PAGE_DELAY_MS = 800;
const OUTPUT_FILE = path.join(__dirname, "anime-tv-import.jsonl");

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

function mapAnimeToTvDoc(anime) {
  const malId = anime.mal_id;
  const poster =
    anime?.images?.jpg?.large_image_url ||
    anime?.images?.jpg?.image_url ||
    anime?.images?.webp?.large_image_url ||
    anime?.images?.webp?.image_url ||
    null;

  const backdrop =
    anime?.trailer?.images?.maximum_image_url ||
    anime?.trailer?.images?.large_image_url ||
    anime?.trailer?.images?.medium_image_url ||
    poster;

  const genreIds = Array.isArray(anime.genres)
    ? anime.genres.map((g) => Number(g?.mal_id)).filter((n) => Number.isFinite(n))
    : [];

  const tags = ["anime"];
  if (anime.type) tags.push(String(anime.type).toLowerCase());
  if (anime.rating) tags.push(String(anime.rating).toLowerCase());

  const dedupedTags = [...new Set(tags)];
  const runtimeSeconds = parseRuntimeSeconds(anime.duration);

  return {
    // Keep `type: "tv"` so it lands in existing TV flows.
    type: "tv",
    // Use a namespaced id to avoid colliding with TMDB numeric ids.
    id: `anime_${malId}`,
    mal_id: malId,
    source: "jikan",
    is_anime: true,
    tags: dedupedTags,
    title: anime.title || anime.title_english || anime.title_japanese || `Anime ${malId}`,
    name: anime.title || anime.title_english || anime.title_japanese || `Anime ${malId}`,
    release_date: null,
    first_air_date: firstDate(anime.aired),
    poster_path: poster,
    backdrop_path: backdrop,
    overview: anime.synopsis || anime.background || null,
    runtimeSeconds,
    season_amount: typeof anime.episodes === "number" ? anime.episodes : null,
    popularity: typeof anime.popularity === "number" ? anime.popularity : 0,
    vote_average: coerceVote(anime.score),
    genre_ids: genreIds,
  };
}

async function fetchJikanPage(page) {
  const url = new URL(JIKAN_BASE);
  url.searchParams.set("page", String(page));
  url.searchParams.set("limit", "25");
  url.searchParams.set("type", "tv");
  url.searchParams.set("order_by", "score");
  url.searchParams.set("sort", "desc");

  const res = await fetch(url.toString(), {
    headers: { Accept: "application/json" },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Jikan error ${res.status}: ${text.slice(0, 300)}`);
  }

  return res.json();
}

async function run() {
  loadEnvLocal();
  const startPage = Math.max(1, parseInt(process.argv[2] || "1", 10));
  const maxPages = Math.max(1, parseInt(process.argv[3] || String(MAX_PAGES), 10));
  const resumeMode = process.argv.includes("--resume");
  let scanned = 0;
  let skippedExisting = 0;

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
    for (const anime of rows) {
      const malId = anime?.mal_id;
      if (!malId) continue;
      if (existing.has(String(malId))) {
        skippedExisting++;
        continue;
      }

      const doc = mapAnimeToTvDoc(anime);
      fs.appendFileSync(OUTPUT_FILE, `${JSON.stringify(doc)}\n`);
      existing.add(String(malId));
      scanned++;
      appendedThisPage++;
    }

    const hasNext = Boolean(payload?.pagination?.has_next_page);
    console.log(
      `page ${page}: fetched=${rows.length}, appended=${appendedThisPage}, total_appended=${scanned}, skipped_existing=${skippedExisting}`
    );
    if (!hasNext) break;
    await sleep(PAGE_DELAY_MS);
  }

  console.log(
    `done: appended=${scanned}, skipped_existing=${skippedExisting}, resume=${resumeMode}, output=${OUTPUT_FILE}`
  );
}

run().catch((err) => {
  console.error("import-anime-to-tv failed:", err.message);
  process.exit(1);
});

