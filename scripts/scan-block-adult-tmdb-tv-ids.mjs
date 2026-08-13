/**
 * Scan catalog TMDB TV ids and flag adult / hentai rows.
 *
 * Checks every unique `id`, `tmdb_id`, and `external_ids.tmdb_id` on TV docs
 * against TMDB keywords (hentai, adult animation, etc.).
 *
 *   node scripts/scan-block-adult-tmdb-tv-ids.mjs
 *   node scripts/scan-block-adult-tmdb-tv-ids.mjs --execute
 *   node scripts/scan-block-adult-tmdb-tv-ids.mjs --execute --anime-only
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
const { fetchTmdbTvPolicyProbe, isBlockedAdultTmdbTvShow, normalizeTmdbId } =
  await import(policyUrl);

const enrichUrl = pathToFileURL(
  path.join(path.dirname(fileURLToPath(import.meta.url)), "../src/lib/animeTmdbPolicyEnrich.js")
).href;
const { isBlockedAdultTmdbTvShowEnriched } = await import(enrichUrl);

const DB_NAME = "teavie";
const COLLECTION = "content";

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function tmdbToken() {
  return (
    process.env.TMDB_BEARER?.trim() ||
    process.env.NEXT_PUBLIC_TMDB_BEARER?.trim() ||
    process.env.TMDB_API_KEY?.trim() ||
    process.env.NEXT_PUBLIC_TMDB_API_KEY?.trim() ||
    ""
  );
}

/** @param {Record<string, unknown>} doc */
function collectDocTmdbIds(doc, out) {
  for (const raw of [doc.id, doc.tmdb_id, doc.external_ids?.tmdb_id]) {
    const n = normalizeTmdbId(raw);
    if (n != null) out.add(n);
  }
}

async function main() {
  loadMongoEnv();
  const execute = process.argv.includes("--execute");
  const animeOnly = process.argv.includes("--anime-only");
  const delayMs = Math.max(0, Number(process.argv.find((a) => a.startsWith("--delay="))?.split("=")[1] ?? 250));

  const uri = String(process.env.MONGODB_URI ?? "").trim();
  const token = tmdbToken();
  if (!uri) {
    console.error("Missing MONGODB_URI");
    process.exit(1);
  }
  if (!token) {
    console.error("Missing TMDB auth (TMDB_BEARER / TMDB_API_KEY)");
    process.exit(1);
  }

  const client = new MongoClient(uri);
  await client.connect();
  const col = client.db(DB_NAME).collection(COLLECTION);

  const filter = animeOnly
    ? {
        type: "tv",
        $or: [
          { id: { $regex: /^anime_/ } },
          { is_anime: true },
          { tags: "anime" },
        ],
      }
    : { type: "tv" };

  const docs = await col
    .find(filter)
    .project({ id: 1, tmdb_id: 1, external_ids: 1, title: 1, name: 1, adult: 1 })
    .toArray();

  /** @type {Set<number>} */
  const ids = new Set();
  for (const doc of docs) collectDocTmdbIds(doc, ids);

  console.log(
    `mongo=${mongoHostHint(uri)} scanning ${ids.size} unique TMDB TV ids (${docs.length} docs, animeOnly=${animeOnly})`
  );

  /** @type {Array<{ id: number; title: string; keywords: string[] }>} */
  const blocked = [];

  for (const tmdbId of [...ids].sort((a, b) => a - b)) {
    const probe = await fetchTmdbTvPolicyProbe(tmdbId);
    const tmdbBlocked = probe && isBlockedAdultTmdbTvShow(probe);
    const enrichedBlocked =
      probe &&
      (await isBlockedAdultTmdbTvShowEnriched(tmdbId, probe, { collection: col }));
    if (tmdbBlocked || enrichedBlocked) {
      const keywords = (probe.keywords?.results ?? [])
        .map((k) => k?.name)
        .filter(Boolean)
        .slice(0, 8);
      blocked.push({
        id: tmdbId,
        title: String(probe.name ?? ""),
        keywords,
        via: tmdbBlocked ? "tmdb" : "mal/anilist",
      });
      console.log(
        `  BLOCK tmdb_id=${tmdbId} ${probe.name ?? ""} via=${tmdbBlocked ? "tmdb" : "mal/anilist"} keywords=${keywords.join(", ")}`
      );
    }
    if (delayMs > 0) await sleep(delayMs);
  }

  console.log(`blocked TMDB TV ids: ${blocked.length}`);
  if (blocked.length === 0) {
    await client.close();
    return;
  }

  if (!execute) {
    console.log("Dry-run only. Re-run with --execute to set adult: true on matching catalog rows.");
    await client.close();
    return;
  }

  let updated = 0;
  for (const row of blocked) {
    const idValues = [row.id, String(row.id)];
    const r = await col.updateMany(
      {
        type: "tv",
        $or: [
          { id: { $in: idValues } },
          { tmdb_id: row.id },
          { "external_ids.tmdb_id": row.id },
        ],
      },
      { $set: { adult: true, updatedAt: new Date() } }
    );
    updated += r.modifiedCount;
  }

  console.log(`flagged adult: modifiedCount=${updated}`);
  console.log(
    "Add any new ids to BLOCKED_TV_TMDB_IDS in src/lib/animeContentPolicy.js:",
    blocked.map((b) => b.id).join(", ")
  );
  await client.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
