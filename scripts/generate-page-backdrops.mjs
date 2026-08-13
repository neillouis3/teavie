#!/usr/bin/env node
/**
 * Downloads w1280 backdrop JPGs for static page shells (library, browse, account pages).
 * Run: node scripts/generate-page-backdrops.mjs
 */
import { writeFileSync, mkdirSync, readFileSync } from "fs";
import { join } from "path";

const ROOT = join(import.meta.dirname, "..");
const OUT_DIR = join(ROOT, "public/page-backdrops");
const TMDB_W1280 = "https://image.tmdb.org/t/p/w1280";

/** @type {{ file: string, title?: string, malId?: number, filter?: Record<string, unknown> }[]} */
const PAGE_BACKDROPS = [
  { file: "shell.jpg", title: "Breaking Bad", filter: { type: "tv" } },
  { file: "browse.jpg", title: "Inception", filter: { type: "movie" } },
  { file: "shows.jpg", title: "Breaking Bad", filter: { type: "tv" } },
  { file: "movies.jpg", title: "Interstellar", filter: { type: "movie" } },
  { file: "anime.jpg", malId: 21 },
  { file: "kdrama.jpg", title: "Running Man" },
  { file: "profile.jpg", title: "La La Land", filter: { type: "movie" } },
  { file: "activity.jpg", title: "Squid Game" },
  { file: "settings.jpg", malId: 813 },
];

function loadEnvFile() {
  for (const name of [".env.local", ".env"]) {
    try {
      const raw = readFileSync(join(ROOT, name), "utf8");
      for (const line of raw.split("\n")) {
        const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
        if (!m || process.env[m[1]] != null) continue;
        process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
      }
      return;
    } catch {
      /* try next */
    }
  }
}

function escapeRegExp(input) {
  return String(input).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function backdropUrlFromDoc(doc) {
  const backdrop = String(doc?.backdrop_path ?? "").trim();
  if (backdrop) {
    if (/^https?:\/\//i.test(backdrop)) return backdrop;
    const path = backdrop.startsWith("/") ? backdrop : `/${backdrop}`;
    return `${TMDB_W1280}${path}`;
  }

  const anilistBanner = doc?.anilist?.bannerImage;
  if (typeof anilistBanner === "string" && anilistBanner.trim()) {
    return anilistBanner.trim();
  }

  const poster = String(doc?.poster_path ?? "").trim();
  if (poster) {
    if (/^https?:\/\//i.test(poster)) return poster;
    const path = poster.startsWith("/") ? poster : `/${poster}`;
    return `${TMDB_W1280}${path}`;
  }

  return null;
}

async function findDoc(col, spec) {
  const baseFilter = spec.filter ?? {};

  if (spec.malId != null) {
    return col.findOne(
      {
        $or: [
          { mal_id: spec.malId },
          { mal_id: String(spec.malId) },
          { id: `anime_${spec.malId}` },
        ],
      },
      { projection: { id: 1, name: 1, title: 1, backdrop_path: 1, poster_path: 1, anilist: 1 } }
    );
  }

  if (spec.title) {
    const name = new RegExp(`^${escapeRegExp(spec.title)}$`, "i");
    return col.findOne(
      {
        $and: [
          baseFilter,
          { $or: [{ name }, { title: name }, { original_name: name }] },
        ],
      },
      { projection: { id: 1, name: 1, title: 1, backdrop_path: 1, poster_path: 1, anilist: 1 } }
    );
  }

  return null;
}

loadEnvFile();

const { default: clientPromise } = await import("../src/lib/mongo.js");
const client = await clientPromise;
const col = client.db("teavie").collection("content");

mkdirSync(OUT_DIR, { recursive: true });

let ok = 0;
let fail = 0;

for (const spec of PAGE_BACKDROPS) {
  const doc = await findDoc(col, spec);
  if (!doc) {
    console.error(`FAIL ${spec.file}: no catalog match`);
    fail += 1;
    continue;
  }

  const label = doc.name ?? doc.title ?? doc.id;
  const url = backdropUrlFromDoc(doc);
  if (!url) {
    console.error(`FAIL ${spec.file}: no backdrop for ${label}`);
    fail += 1;
    continue;
  }

  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.error(`FAIL ${spec.file}: HTTP ${res.status} (${label})`);
      fail += 1;
      continue;
    }
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 2000) {
      console.error(`FAIL ${spec.file}: file too small (${label})`);
      fail += 1;
      continue;
    }
    writeFileSync(join(OUT_DIR, spec.file), buf);
    console.log(`OK   ${spec.file} ← ${label} (${Math.round(buf.length / 1024)}kb)`);
    ok += 1;
  } catch (err) {
    console.error(`FAIL ${spec.file}:`, err.message);
    fail += 1;
  }
}

await client.close();

if (!ok) {
  console.error("No page backdrops downloaded.");
  process.exit(1);
}

console.log(`Done: ${ok} ok, ${fail} failed`);
