/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");
const { MongoClient } = require("mongodb");

const DB_NAME = "teavie";
const COLLECTION = "content";
const INPUT_FILE = path.join(__dirname, "anime-tv-import.jsonl");

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

function normalizeTitle(value) {
  if (typeof value !== "string") return "";
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function pickDate(doc) {
  return (
    (typeof doc.first_air_date === "string" && doc.first_air_date) ||
    (typeof doc.release_date === "string" && doc.release_date) ||
    ""
  );
}

function buildKeys(doc) {
  const keys = [];
  if (doc.mal_id != null) keys.push(`mal:${String(doc.mal_id)}`);
  if (doc.id != null) keys.push(`id:${String(doc.id)}`);
  const title = normalizeTitle(doc.title || doc.name || "");
  const date = pickDate(doc);
  if (title && date) keys.push(`td:${title}|${date}`);
  if (title) keys.push(`t:${title}`);
  return keys;
}

function ensureAnimeFields(doc) {
  const next = { ...doc };
  next.type = "tv";
  next.is_anime = true;
  next.source = next.source || "jikan";
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

  const incomingRaw = readJsonl(INPUT_FILE);
  if (!incomingRaw.length) {
    console.log("No records found in JSONL.");
    return;
  }

  const client = new MongoClient(uri);
  await client.connect();

  const db = client.db(DB_NAME);
  const collection = db.collection(COLLECTION);

  try {
    const existingRows = await collection
      .find(
        { type: "tv" },
        {
          projection: {
            _id: 0,
            id: 1,
            mal_id: 1,
            title: 1,
            name: 1,
            first_air_date: 1,
            release_date: 1,
          },
        }
      )
      .toArray();

    const existingKeys = new Set();
    for (const row of existingRows) {
      for (const k of buildKeys(row)) existingKeys.add(k);
    }

    let inserted = 0;
    let skipped = 0;
    const toInsert = [];

    for (const raw of incomingRaw) {
      const doc = ensureAnimeFields(raw);
      const keys = buildKeys(doc);
      const overlap = keys.some((k) => existingKeys.has(k));
      if (overlap) {
        skipped++;
        continue;
      }
      toInsert.push(doc);
      for (const k of keys) existingKeys.add(k);
    }

    if (toInsert.length > 0) {
      await collection.insertMany(toInsert, { ordered: false });
      inserted = toInsert.length;
    }

    console.log(
      `done: input=${incomingRaw.length}, inserted=${inserted}, skipped_overlap=${skipped}, db=${DB_NAME}.${COLLECTION}`
    );
  } finally {
    await client.close();
  }
}

run().catch((err) => {
  console.error("import-anime-jsonl-to-mongo failed:", err.message);
  process.exit(1);
});

