/* eslint-disable no-console */
/**
 * Remove legacy TV: Japan + animation genre, but not from import-anime-to-tv.js
 * (`source: "jikan"` + `mal_id`). Keeps `anime_*` ids, Jikan imports, and non-animation TV.
 *
 *   node scripts/cleanup-tv-jp-anime-mongo.js
 *   node scripts/cleanup-tv-jp-anime-mongo.js --dry-run
 *   node scripts/cleanup-tv-jp-anime-mongo.js --check-id 1429
 *
 * Loads `teavie/.env` then `teavie/.env.local` (merged; shell env wins if already set).
 * Prints host + counts after connect so you can confirm the target cluster.
 */
const { MongoClient } = require("mongodb");
const { loadMongoEnv, mongoHostHint } = require("./lib/mongoEnv.cjs");
const { shouldPruneTvAnimeWithoutAnilist } = require("./lib/tvJpAnimePrune.cjs");

const DB_NAME = "teavie";
const COLL = "content";

function hasFlag(flag) {
  return process.argv.includes(flag);
}

function argAfter(flag) {
  const i = process.argv.indexOf(flag);
  if (i === -1) return null;
  return process.argv[i + 1] ?? null;
}

async function run() {
  loadMongoEnv();
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error(
      "MONGODB_URI missing. Set it in the shell or teavie/.env.local (or teavie/.env)."
    );
    process.exit(1);
  }

  const dryRun = hasFlag("--dry-run");
  const checkIdRaw = argAfter("--check-id");

  const client = new MongoClient(uri);
  await client.connect();
  await client.db("admin").command({ ping: 1 });

  const col = client.db(DB_NAME).collection(COLL);
  const tvCount = await col.countDocuments({ type: "tv" });
  const totalApprox = await col.estimatedDocumentCount();

  console.log(
    [
      "mongo: ping ok",
      `host: ${mongoHostHint(uri)}`,
      `db: ${DB_NAME}`,
      `collection: ${COLL}`,
      `tv documents: ${tvCount}`,
      `collection approx size: ${totalApprox}`,
    ].join(" | ")
  );

  if (checkIdRaw != null && String(checkIdRaw).trim() !== "") {
    const raw = String(checkIdRaw).trim();
    const idOr = [{ id: raw }];
    const n = Number(raw);
    if (Number.isFinite(n)) idOr.push({ id: n });
    const probe = await col.findOne({ type: "tv", $or: idOr });
    console.log(
      probe
        ? `--check-id: FOUND tv id=${probe.id} name=${probe.name ?? probe.title ?? "?"}`
        : `--check-id: no type:tv with id ${raw}`
    );
  }

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
        imdb_genres: 1,
        omdb: 1,
        is_anime: 1,
        tags: 1,
        source: 1,
        mal_id: 1,
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
