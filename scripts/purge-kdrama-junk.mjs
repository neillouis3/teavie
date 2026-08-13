/**
 * Remove low-signal K-Drama catalog rows (no poster/backdrop, variety specials, web shorts).
 *
 *   node scripts/purge-kdrama-junk.mjs
 *   node scripts/purge-kdrama-junk.mjs --execute
 */
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createRequire } from "node:module";
import { MongoClient } from "mongodb";

const require = createRequire(import.meta.url);
const { loadMongoEnv, mongoHostHint } = require(path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "lib/mongoEnv.cjs"
));

const policyUrl = pathToFileURL(
  path.join(path.dirname(fileURLToPath(import.meta.url)), "../src/lib/kdramaCatalogPolicy.js")
).href;
const { catalogKdramaJunkMongoMatch } = await import(policyUrl);

const DB_NAME = "teavie";
const COLLECTION = "content";

async function main() {
  loadMongoEnv();
  const execute = process.argv.includes("--execute");
  const uri = String(process.env.MONGODB_URI ?? "").trim();
  if (!uri) {
    console.error("Missing MONGODB_URI");
    process.exit(1);
  }

  const client = new MongoClient(uri);
  await client.connect();
  const col = client.db(DB_NAME).collection(COLLECTION);

  const filter = catalogKdramaJunkMongoMatch();
  const total = await col.countDocuments(filter);
  const sample = await col
    .find(filter)
    .project({ id: 1, title: 1, name: 1, poster_path: 1, vote_count: 1 })
    .sort({ popularity: -1 })
    .limit(30)
    .toArray();

  console.log(`mongo=${mongoHostHint(uri)} kdrama junk rows: ${total}`);
  for (const d of sample) {
    const art = d.poster_path?.trim() ? "poster" : "no-art";
    console.log(`  id=${d.id} [${art}] ${d.title ?? d.name ?? ""}`);
  }
  if (total > sample.length) {
    console.log(`  … and ${total - sample.length} more`);
  }

  if (!execute) {
    console.log("Dry-run only. Re-run with --execute to delete these documents.");
    await client.close();
    return;
  }

  const r = await col.deleteMany(filter);
  console.log(`deleted: acknowledged=${r.acknowledged} deletedCount=${r.deletedCount}`);
  await client.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
