/**
 * Remove catalog movies flagged TMDB-adult (`adult: true` on stored doc).
 *
 * Default: dry-run (counts + sample ids). Pass `--execute` to delete.
 *
 *   node scripts/purge-adult-catalog-movies.mjs
 *   node scripts/purge-adult-catalog-movies.mjs --execute
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { MongoClient } from "mongodb";

const require = createRequire(import.meta.url);
const { loadMongoEnv, mongoHostHint } = require(path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "lib/mongoEnv.cjs"
));

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

  const filter = { type: "movie", adult: true };
  const total = await col.countDocuments(filter);
  const sample = await col
    .find(filter)
    .project({ id: 1, title: 1, name: 1 })
    .limit(25)
    .toArray();

  console.log(`mongo=${mongoHostHint(uri)} adult-flagged movies: ${total}`);
  for (const d of sample) {
    console.log(`  id=${d.id} ${d.title ?? d.name ?? ""}`);
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
