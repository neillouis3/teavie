/* eslint-disable no-console */
/**
 * Prune Attack on Titan catalog rows and re-import each season with fresh
 * Jikan + AniList data so mal_id, anilist_id, and titles stay aligned.
 *
 *   node scripts/refresh-attack-on-titan.js
 *   node scripts/refresh-attack-on-titan.js --dry-run
 */
const path = require("path");
const fs = require("fs");
const { MongoClient } = require("mongodb");
const { loadMongoEnv, mongoHostHint } = require("./lib/mongoEnv.cjs");
const { importMalIdsToJsonl } = require("./import-anime-to-tv");

const DB_NAME = "teavie";
const COLLECTION = "content";

/** Main Attack on Titan TV seasons on MAL (each is its own catalog row). */
const AOT_MAL_IDS = [16498, 25777, 35760, 38524, 40028, 48583];

/** Known AniList ids for the same seasons (used only for deletion sweep). */
const AOT_ANILIST_IDS = [16498, 20958, 99147, 104578, 110277, 131681];

const AOT_TMDB_SHOW_ID = 1429;

/** Safety net when AniList lookup fails during import. */
const AOT_ANILIST_BY_MAL = {
  16498: 16498,
  25777: 20958,
  35760: 99147,
  38524: 104578,
  40028: 110277,
  48583: 131681,
};

const SPINOFF_TITLE_RE =
  /chuugakkou|junior high|bahamut|microman|ideon|hoshi no kyojin|bubuki/i;

function isAttackOnTitanTitle(value) {
  const t = String(value || "").trim();
  if (!t) return false;
  if (SPINOFF_TITLE_RE.test(t)) return false;
  return /attack on titan|shingeki no kyojin/i.test(t);
}

function buildDeleteFilter() {
  const animeIds = AOT_MAL_IDS.map((mal) => `anime_${mal}`);
  return {
    type: "tv",
    $or: [
      { mal_id: { $in: AOT_MAL_IDS } },
      { id: { $in: [...animeIds, AOT_TMDB_SHOW_ID, String(AOT_TMDB_SHOW_ID)] } },
      { anilist_id: { $in: AOT_ANILIST_IDS } },
      { tmdb_id: AOT_TMDB_SHOW_ID },
      { tmdb_show_id: AOT_TMDB_SHOW_ID },
      {
        $and: [
          {
            $or: [
              { title: /attack on titan/i },
              { name: /attack on titan/i },
              { title: /shingeki no kyojin/i },
              { name: /shingeki no kyojin/i },
            ],
          },
          { title: { $not: SPINOFF_TITLE_RE } },
          { name: { $not: SPINOFF_TITLE_RE } },
        ],
      },
    ],
  };
}

async function listMatches(col) {
  const filter = buildDeleteFilter();
  return col
    .find(filter)
    .project({
      id: 1,
      mal_id: 1,
      anilist_id: 1,
      tmdb_id: 1,
      title: 1,
      name: 1,
    })
    .toArray();
}

async function upsertDocs(col, docs) {
  let upserted = 0;
  let modified = 0;
  for (const doc of docs) {
    const matchClauses = [{ id: doc.id }];
    if (doc.mal_id != null) matchClauses.push({ mal_id: doc.mal_id });
    if (doc.anilist_id != null) matchClauses.push({ anilist_id: doc.anilist_id });
    const payload = { ...doc, updated_at: new Date().toISOString() };
    const result = await col.updateOne(
      { type: "tv", $or: matchClauses },
      { $set: payload },
      { upsert: true }
    );
    if (result.upsertedCount) upserted += result.upsertedCount;
    if (result.modifiedCount) modified += result.modifiedCount;
    console.log(
      `upsert id=${doc.id} mal=${doc.mal_id} anilist=${doc.anilist_id ?? "null"} title=${doc.title}`
    );
  }
  return { upserted, modified };
}

async function run() {
  loadMongoEnv();
  const dryRun = process.argv.includes("--dry-run");
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is missing (.env or .env.local)");

  const tempJsonl = path.join(__dirname, ".attack-on-titan-refresh.jsonl");

  const client = new MongoClient(uri);
  await client.connect();
  const col = client.db(DB_NAME).collection(COLLECTION);

  try {
    const matches = await listMatches(col);
    console.log(`mongo=${mongoHostHint(uri)} attack_on_titan_matches=${matches.length}`);
    for (const row of matches) {
      console.log(
        `  delete candidate id=${row.id} mal=${row.mal_id ?? "-"} anilist=${row.anilist_id ?? "-"} ${row.title ?? row.name ?? ""}`
      );
    }

    if (dryRun) {
      console.log("Dry run — no deletes or imports.");
      return;
    }

    if (matches.length) {
      const del = await col.deleteMany(buildDeleteFilter());
      console.log(`deleted=${del.deletedCount}`);
    }

    console.log(`fetching fresh data for mal_ids=${AOT_MAL_IDS.join(",")}`);
    const count = await importMalIdsToJsonl(AOT_MAL_IDS, tempJsonl);
    if (!count) throw new Error("No documents fetched from Jikan/AniList");

    const docs = fs
      .readFileSync(tempJsonl, "utf8")
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => JSON.parse(line));

    for (const doc of docs) {
      const mal = Number(doc.mal_id);
      const fallback = AOT_ANILIST_BY_MAL[mal];
      if (!doc.anilist_id && fallback) {
        doc.anilist_id = fallback;
        doc.anilist_mal_id = mal;
        doc.external_ids = {
          ...(doc.external_ids && typeof doc.external_ids === "object" ? doc.external_ids : {}),
          mal_id: mal,
          anilist_id: fallback,
        };
        if (doc.anilist && typeof doc.anilist === "object") {
          doc.anilist.id = fallback;
        }
      }
      const aniScore = Number(doc.anilist?.averageScore);
      if (Number.isFinite(aniScore) && aniScore > 0) {
        doc.vote_average = Math.round((aniScore / 10) * 10) / 10;
      } else if (typeof doc.vote_average === "number" && Number.isFinite(doc.vote_average)) {
        doc.vote_average = Math.round(doc.vote_average * 10) / 10;
      }
    }

    const missingAnilist = docs.filter((d) => !d.anilist_id);
    if (missingAnilist.length) {
      console.warn(
        `warning: ${missingAnilist.length} season(s) still missing anilist_id:`,
        missingAnilist.map((d) => d.id).join(", ")
      );
    }

    const write = await upsertDocs(col, docs);
    console.log(`done: imported=${docs.length}, upserted=${write.upserted}, modified=${write.modified}`);
  } finally {
    await client.close();
    if (fs.existsSync(tempJsonl)) fs.unlinkSync(tempJsonl);
  }
}

run().catch((err) => {
  console.error("refresh-attack-on-titan failed:", err.message);
  process.exit(1);
});
