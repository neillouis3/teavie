#!/usr/bin/env node
/**
 * Pulls a large mixed poster set from Mongo, downloads JPGs to
 * public/auth-collage/, and writes src/data/auth-collage-posters.json.
 * Runtime uses local files only.
 *
 * Run: node scripts/generate-auth-collage.mjs
 */
import {
  writeFileSync,
  mkdirSync,
  readdirSync,
  unlinkSync,
  readFileSync,
} from "fs";
import { join } from "path";

const ROOT = join(import.meta.dirname, "..");
const OUT_DIR = join(ROOT, "public/auth-collage");
const MANIFEST = join(ROOT, "src/data/auth-collage-posters.json");
const TMDB_W342 = "https://image.tmdb.org/t/p/w342";

/** @typedef {{ id: string, name?: RegExp, malId?: number, filter?: Record<string, unknown> }} TileSpec */

/** @type {{ key: string, label: string, tiles: TileSpec[] }[]} */
const BUCKETS = [
  {
    key: "movie",
    label: "movies",
    tiles: [
      "The Dark Knight",
      "Inception",
      "Interstellar",
      "The Avengers",
      "Avengers: Endgame",
      "Titanic",
      "The Matrix",
      "Pulp Fiction",
      "Joker",
      "Oppenheimer",
      "Dune",
      "Dune: Part Two",
      "Forrest Gump",
      "The Shawshank Redemption",
      "Fight Club",
      "The Godfather",
      "GoodFellas",
      "The Lord of the Rings: The Fellowship of the Ring",
      "Harry Potter and the Philosopher's Stone",
      "Spider-Man: No Way Home",
      "Black Panther",
      "Top Gun: Maverick",
      "Avatar",
      "Barbie",
      "La La Land",
      "Gladiator",
      "Jurassic Park",
      "Back to the Future",
      "Star Wars",
      "The Lion King",
    ].map((title) => ({
      id: slugify(title),
      name: new RegExp(`^${escapeRegExp(title)}$`, "i"),
      filter: { type: "movie" },
    })),
  },
  {
    key: "show",
    label: "shows",
    tiles: [
      "Breaking Bad",
      "Game of Thrones",
      "Stranger Things",
      "The Office",
      "Friends",
      "Succession",
      "The Sopranos",
      "The Boys",
      "INVINCIBLE",
      "The Last of Us",
      "House of the Dragon",
      "The Walking Dead",
      "Better Call Saul",
      "The Simpsons",
      "Rick and Morty",
      "Peaky Blinders",
      "The Mandalorian",
      "The Witcher",
      "Lost",
      "Sherlock",
      "House",
      "Grey's Anatomy",
      "Supernatural",
      "Dexter",
      "Wednesday",
    ].map((title) => ({
      id: slugify(title),
      name: new RegExp(`^${escapeRegExp(title)}$`, "i"),
      filter: {
        type: "tv",
        is_anime: { $ne: true },
        is_kdrama: { $ne: true },
        tags: { $ne: "anime" },
        catalog_categories: { $ne: "kdrama" },
        $nor: [{ id: { $regex: "^anime_" } }],
      },
    })),
  },
  {
    key: "anime",
    label: "anime",
    tiles: [
      ["one-piece", 21],
      ["naruto", 20],
      ["aot", 16498],
      ["death-note", 1535],
      ["demon-slayer", 38000],
      ["jjk", 40748],
      ["spy-family", 50265],
      ["frieren", 52991],
      ["chainsaw-man", 44511],
      ["my-hero-academia", 31964],
      ["hxh", 11061],
      ["one-punch-man", 30276],
      ["cowboy-bebop", 1],
      ["fullmetal-alchemist-brotherhood", 5114],
      ["dragon-ball-z", 813],
      ["bleach", 269],
      ["black-clover", 34572],
      ["code-geass", 1575],
      ["tokyo-ghoul", 22319],
      ["mob-psycho", 32182],
      ["vinland-saga", 37521],
      ["haikyuu", 20583],
      ["steins-gate", 9253],
      ["solo-leveling", 52299],
    ].map(([id, malId]) => ({ id: String(id), malId: Number(malId) })),
  },
  {
    key: "kdrama",
    label: "kdramas",
    tiles: [
      "Squid Game",
      "Crash Landing on You",
      "Goblin",
      "Itaewon Class",
      "Vincenzo",
      "Alchemy of Souls",
      "Weak Hero",
      "Bloodhounds",
      "Sweet Home",
      "Extraordinary Attorney Woo",
      "Business Proposal",
      "Queen of Tears",
      "The Glory",
      "All of Us Are Dead",
      "Kingdom",
      "My Demon",
      "True Beauty",
      "Hotel Del Luna",
      "Boys Over Flowers",
      "Running Man",
      "Twenty Five Twenty One",
      "Start-Up",
      "Mr. Queen",
      "Reply 1988",
    ].map((title) => ({
      id: slugify(title),
      name: new RegExp(`^${escapeRegExp(title)}$`, "i"),
      filter: {
        type: "tv",
        $or: [{ catalog_categories: "kdrama" }, { is_kdrama: true }],
      },
    })),
  },
];

function loadEnvFile() {
  try {
    const raw = readFileSync(join(ROOT, ".env.local"), "utf8");
    for (const line of raw.split("\n")) {
      const m = line.match(/^([^#=]+)=(.*)$/);
      if (!m) continue;
      const key = m[1].trim();
      if (process.env[key]) continue;
      let val = m[2].trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      process.env[key] = val;
    }
  } catch {
    /* optional */
  }
}

function imageUrlFromPosterPath(posterPath) {
  const raw = String(posterPath ?? "").trim();
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) return raw;
  const path = raw.startsWith("/") ? raw : `/${raw}`;
  return `${TMDB_W342}${path}`;
}

function slugify(input) {
  return String(input ?? "poster")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "poster";
}

function escapeRegExp(input) {
  return String(input).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function stableSuffix(input) {
  let hash = 0;
  const text = String(input ?? "");
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
  }
  return hash.toString(36).slice(0, 6);
}

function interleaveBuckets(bucketRows) {
  const out = [];
  const max = Math.max(0, ...bucketRows.map((bucket) => bucket.items.length));
  for (let i = 0; i < max; i += 1) {
    for (const bucket of bucketRows) {
      const item = bucket.items[i];
      if (item) out.push(item);
    }
  }
  return out;
}

async function findTileDoc(col, tile) {
  const baseFilter = {
    poster_path: { $exists: true, $nin: [null, ""] },
    ...(tile.filter ?? {}),
  };

  if (tile.malId != null) {
    return col.findOne(
      {
        $and: [
          baseFilter,
          {
            $or: [
              { mal_id: tile.malId },
              { mal_id: String(tile.malId) },
              { id: `anime_${tile.malId}` },
            ],
          },
        ],
      },
      { projection: { id: 1, name: 1, poster_path: 1 } }
    );
  }

  if (tile.name) {
    return col.findOne(
      {
        $and: [
          baseFilter,
          {
            $or: [
              { name: tile.name },
              { title: tile.name },
              { original_name: tile.name },
            ],
          },
        ],
      },
      { projection: { id: 1, name: 1, title: 1, original_name: 1, poster_path: 1 } }
    );
  }

  return null;
}

loadEnvFile();

const { default: clientPromise } = await import("../src/lib/mongo.js");
const client = await clientPromise;
const col = client.db("teavie").collection("content");

mkdirSync(OUT_DIR, { recursive: true });
for (const file of readdirSync(OUT_DIR)) {
  if (file.endsWith(".svg") || file.endsWith(".jpg")) {
    unlinkSync(join(OUT_DIR, file));
  }
}

let ok = 0;
let fail = 0;
const bucketRows = [];

for (const bucket of BUCKETS) {
  const items = [];
  console.log(`\n${bucket.label}: ${bucket.tiles.length} requested`);

  for (const tile of bucket.tiles) {
    const doc = await findTileDoc(col, tile);
    if (!doc) {
      console.error(`FAIL ${bucket.key}-${tile.id}: no catalog match`);
      fail += 1;
      continue;
    }
    const title = doc.name ?? doc.title ?? doc.original_name ?? doc.id;
    const id = `${bucket.key}-${tile.id}-${stableSuffix(doc?.id ?? title)}`;
    const url = imageUrlFromPosterPath(doc.poster_path);

    if (!url) {
      console.error(`FAIL ${id}: no catalog poster (${title ?? "not found"})`);
      fail += 1;
      continue;
    }

    const out = join(OUT_DIR, `${id}.jpg`);
    try {
      const res = await fetch(url);
      if (!res.ok) {
        console.error(`FAIL ${id}: HTTP ${res.status}`);
        fail += 1;
        continue;
      }
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length < 500) {
        console.error(`FAIL ${id}: file too small`);
        fail += 1;
        continue;
      }
      writeFileSync(out, buf);
      console.log(`OK   ${id} ← ${title} (${Math.round(buf.length / 1024)}kb)`);
      items.push({ id, src: `/auth-collage/${id}.jpg` });
      ok += 1;
    } catch (err) {
      console.error(`FAIL ${id}:`, err.message);
      fail += 1;
    }
  }

  bucketRows.push({ key: bucket.key, items });
}

await client.close();

const downloaded = interleaveBuckets(bucketRows);

if (!downloaded.length) {
  console.error("No posters downloaded.");
  process.exit(1);
}

const grid = [
  ...downloaded,
  ...downloaded.map((p) => ({ id: `${p.id}-alt`, src: p.src })),
  ...downloaded.map((p) => ({ id: `${p.id}-alt2`, src: p.src })),
];

writeFileSync(MANIFEST, `${JSON.stringify({ posters: grid }, null, 2)}\n`);
console.log(`Done: ${ok} posters, ${fail} failed, ${grid.length} grid slots`);
