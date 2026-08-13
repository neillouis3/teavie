/**
 * Remove catalog titles blocked by adult-anime policy (hentai / AniList adult).
 *
 * Matches: MAL Hentai genre, Rx rating, AniList isAdult (except G/PG MAL rows),
 * stored Hentai genre fields. Does not match titles that merely contain "hentai" in the name.
 *
 *   node scripts/purge-hentai-genre-titles.mjs
 *   node scripts/purge-hentai-genre-titles.mjs --execute
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
  path.join(path.dirname(fileURLToPath(import.meta.url)), "../src/lib/animeContentPolicy.js")
).href;
const { catalogBlockedAdultAnimeMongoFilter } = await import(policyUrl);

const DB_NAME = "teavie";
const COLLECTION = "content";

/** @returns {Record<string, unknown>} */
export function hentaiGenreCatalogFilter() {
  return catalogBlockedAdultAnimeMongoFilter();
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

  const filter = hentaiGenreCatalogFilter();
  const total = await col.countDocuments(filter);
  const sample = await col
    .find(filter)
    .project({
      id: 1,
      title: 1,
      name: 1,
      rating: 1,
      imdb_genres: 1,
      "anilist.genres": 1,
      "anilist.isAdult": 1,
      "omdb.genre": 1,
    })
    .limit(30)
    .toArray();

  console.log(`mongo=${mongoHostHint(uri)} blocked adult anime: ${total}`);
  for (const d of sample) {
    const genres =
      d.imdb_genres ??
      d.anilist?.genres ??
      (d.omdb?.genre ? [d.omdb.genre] : []);
    console.log(
      `  id=${d.id} ${d.title ?? d.name ?? ""} rating=${d.rating ?? ""} genres=${JSON.stringify(genres)} isAdult=${d.anilist?.isAdult === true}`
    );
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
