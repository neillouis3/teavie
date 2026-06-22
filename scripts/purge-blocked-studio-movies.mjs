/**
 * Remove catalog movies from blocked production companies (see tmdbMovieContentPolicy).
 *
 * Default: dry-run. Pass `--execute` to delete.
 *
 *   node scripts/purge-blocked-studio-movies.mjs
 *   node scripts/purge-blocked-studio-movies.mjs --execute
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { MongoClient } from "mongodb";
import {
  BLOCKED_MOVIE_PRODUCTION_COMPANIES,
} from "../src/lib/tmdbMovieContentPolicy.js";

const require = createRequire(import.meta.url);
const { loadMongoEnv, mongoHostHint } = require(path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "lib/mongoEnv.cjs"
));

const DB_NAME = "teavie";
const COLLECTION = "content";

function escapeRegex(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function blockedStudiosFilter() {
  return {
    type: "movie",
    $or: BLOCKED_MOVIE_PRODUCTION_COMPANIES.map((name) => ({
      production_companies: {
        $elemMatch: {
          name: { $regex: `^${escapeRegex(name)}$`, $options: "i" },
        },
      },
    })),
  };
}

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
  const filter = blockedStudiosFilter();

  const total = await col.countDocuments(filter);
  const sample = await col
    .find(filter)
    .project({ id: 1, title: 1, name: 1, production_companies: 1 })
    .limit(25)
    .toArray();

  console.log(
    `mongo=${mongoHostHint(uri)} blocked-studio movies: ${total} (${BLOCKED_MOVIE_PRODUCTION_COMPANIES.join(", ")})`
  );
  for (const d of sample) {
    const studios = (d.production_companies ?? [])
      .map((c) => c?.name)
      .filter(Boolean)
      .join(", ");
    console.log(`  id=${d.id} ${d.title ?? d.name ?? ""} [${studios}]`);
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
