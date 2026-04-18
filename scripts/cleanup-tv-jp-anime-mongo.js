/* eslint-disable no-console */
/**
 * Remove TV docs that are anime-like but have no AniList id:
 * is_anime, tags "anime", or JP/ja + animation genre — unless anilist_id / external_ids.anilist_id is set.
 *
 *   node scripts/cleanup-tv-jp-anime-mongo.js
 *   node scripts/cleanup-tv-jp-anime-mongo.js --dry-run
 *
 * Requires MONGODB_URI in teavie/.env.local
 */
const path = require("path");
const fs = require("fs");
const { MongoClient } = require("mongodb");
const { shouldPruneTvAnimeWithoutAnilist } = require("./lib/tvJpAnimePrune.cjs");

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

function hasFlag(flag) {
  return process.argv.includes(flag);
}

async function run() {
  loadEnvLocal();
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("MONGODB_URI missing. Set it in teavie/.env.local");
    process.exit(1);
  }

  const dryRun = hasFlag("--dry-run");
  const client = new MongoClient(uri);
  await client.connect();
  const col = client.db("teavie").collection("content");

  const cursor = col.find(
    { type: "tv" },
    {
      projection: {
        _id: 1,
        id: 1,
        name: 1,
        type: 1,
        origin_country: 1,
        original_language: 1,
        genre_ids: 1,
        genres: 1,
        is_anime: 1,
        tags: 1,
        anilist_id: 1,
        external_ids: 1,
      },
    }
  );

  const toDelete = [];
  for await (const doc of cursor) {
    if (shouldPruneTvAnimeWithoutAnilist(doc)) {
      toDelete.push(doc._id);
    }
  }

  console.log(`matched for deletion: ${toDelete.length} (dry_run=${dryRun})`);

  if (dryRun || toDelete.length === 0) {
    await client.close();
    return;
  }

  const chunkSize = 500;
  let deleted = 0;
  for (let i = 0; i < toDelete.length; i += chunkSize) {
    const chunk = toDelete.slice(i, i + chunkSize);
    const r = await col.deleteMany({ _id: { $in: chunk } });
    deleted += r.deletedCount;
    console.log(`deleted batch: ${r.deletedCount} (total ${deleted}/${toDelete.length})`);
  }

  console.log(`done: deletedCount=${deleted}`);
  await client.close();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
