/**
 * Delete one catalog row from `teavie.content` by type + id (TMDB numeric id or string).
 *
 *   node scripts/delete-catalog-content.mjs --type=movie --id=226674 --execute
 *
 * Without `--execute`, only prints what would match.
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

function argValue(name) {
  const prefix = `${name}=`;
  const eq = process.argv.find((a) => a.startsWith(prefix));
  if (eq) return eq.slice(prefix.length);
  const i = process.argv.indexOf(name);
  if (i !== -1) return process.argv[i + 1] ?? "";
  return "";
}

async function main() {
  loadMongoEnv();
  const execute = process.argv.includes("--execute");
  const type = String(argValue("--type") || argValue("type") || "").trim();
  const idRaw = String(argValue("--id") || argValue("id") || "").trim();
  const uri = String(process.env.MONGODB_URI ?? "").trim();

  if (!uri) {
    console.error("Missing MONGODB_URI");
    process.exit(1);
  }
  if (type !== "movie" && type !== "tv") {
    console.error('Usage: --type=movie|tv --id=<id> [--execute]');
    process.exit(1);
  }
  if (!idRaw) {
    console.error("Missing --id=");
    process.exit(1);
  }

  const nid = Number(idRaw);
  const idVariants = Number.isFinite(nid) && String(nid) === idRaw ? [nid, idRaw] : [idRaw];

  const filter = { type, id: { $in: idVariants } };

  const client = new MongoClient(uri);
  await client.connect();
  const col = client.db(DB_NAME).collection(COLLECTION);

  const found = await col.find(filter).project({ id: 1, title: 1, name: 1 }).toArray();
  console.log(`mongo=${mongoHostHint(uri)} matches=${found.length}`);
  for (const d of found) {
    console.log(`  id=${d.id} ${d.title ?? d.name ?? ""}`);
  }

  if (!execute) {
    console.log("Dry-run. Add --execute to delete.");
    await client.close();
    return;
  }

  const r = await col.deleteMany(filter);
  console.log(`deletedCount=${r.deletedCount}`);
  await client.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
