/* eslint-disable no-console */
/**
 * Backfill `title`, `name`, and `title_aliases` on anime catalog rows (`anime_*` ids)
 * so English/romaji/native/synonyms match import-anime-to-tv.js behavior and search works.
 *
 *   node scripts/backfill-anime-titles.js --dry-run
 *   node scripts/backfill-anime-titles.js
 */
const { MongoClient } = require("mongodb");
const { loadMongoEnv, mongoHostHint } = require("./lib/mongoEnv.cjs");

const DB = "teavie";
const COLL = "content";
const MAX_ALIASES = 64;

function pickString(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function pickArrayStrings(values) {
  if (!Array.isArray(values)) return [];
  return values
    .map((v) => (typeof v === "string" ? v.trim() : ""))
    .filter(Boolean);
}

function buildTitleAliasesFromDoc(doc) {
  const set = new Set();
  const add = (s) => {
    const t = pickString(s);
    if (t) set.add(t);
  };
  add(doc.title);
  add(doc.name);
  const a = doc.anilist;
  if (a && typeof a === "object") {
    add(a.title?.romaji);
    add(a.title?.english);
    add(a.title?.native);
    for (const s of pickArrayStrings(a.synonyms)) add(s);
  }
  return [...set].slice(0, MAX_ALIASES);
}

function preferredTitleFromDoc(doc) {
  const malId =
    typeof doc.mal_id === "number" && doc.mal_id > 0
      ? doc.mal_id
      : Number.parseInt(String(doc.id || "").replace(/^anime_/, ""), 10) || 0;
  const fallback = malId > 0 ? `Anime ${malId}` : pickString(doc.title) || "Untitled";
  const a = doc.anilist;
  return (
    pickString(a?.title?.english) ||
    pickString(doc.title_english) ||
    pickString(doc.title) ||
    pickString(a?.title?.romaji) ||
    pickString(a?.title?.native) ||
    fallback
  );
}

function hasFlag(flag) {
  return process.argv.includes(flag);
}

async function run() {
  loadMongoEnv();
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("MONGODB_URI missing");
    process.exit(1);
  }
  const dryRun = hasFlag("--dry-run");

  const client = new MongoClient(uri);
  await client.connect();
  await client.db("admin").command({ ping: 1 });
  console.log(`mongo ok | host ${mongoHostHint(uri)}`);

  const col = client.db(DB).collection(COLL);
  const filter = {
    type: "tv",
    id: { $regex: /^anime_/ },
  };

  let scanned = 0;
  let wouldUpdate = 0;
  let updated = 0;

  const cursor = col.find(filter, {
    projection: {
      id: 1,
      mal_id: 1,
      title: 1,
      name: 1,
      title_aliases: 1,
      anilist: 1,
    },
  });

  for await (const doc of cursor) {
    scanned++;
    const nextTitle = preferredTitleFromDoc(doc);
    const nextAliases = buildTitleAliasesFromDoc(doc);
    const prevAliases = Array.isArray(doc.title_aliases) ? doc.title_aliases : [];
    const aliasesEqual =
      prevAliases.length === nextAliases.length &&
      prevAliases.every((v, i) => v === nextAliases[i]);
    const changed =
      doc.title !== nextTitle ||
      doc.name !== nextTitle ||
      !aliasesEqual;

    if (changed) wouldUpdate++;

    if (!dryRun && changed) {
      const r = await col.updateOne(
        { _id: doc._id },
        {
          $set: {
            title: nextTitle,
            name: nextTitle,
            title_aliases: nextAliases,
          },
        }
      );
      if (r.modifiedCount) updated++;
    }
  }

  console.log(
    `scanned=${scanned} need_update=${wouldUpdate} ${dryRun ? "(dry-run)" : `modified=${updated}`}`
  );
  await client.close();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
