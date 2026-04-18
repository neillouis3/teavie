import clientPromise from "@/lib/mongo";

/**
 * Map TMDB TV id → Teavie catalog `id` string (`anime_*` preferred when two rows share a TMDB id).
 * @param {Iterable<{ id: unknown; tmdb_id?: unknown; external_ids?: { tmdb_id?: unknown } }>} docs
 * @returns {Map<number, string>}
 */
export function buildTmdbTvIdToCatalogIdMap(docs) {
  /** @type {Map<number, string>} */
  const map = new Map();
  for (const doc of docs) {
    const catalogId = String(doc.id);
    const keys = new Set();
    const tid = typeof doc.tmdb_id === "number" ? doc.tmdb_id : Number(doc.tmdb_id);
    if (Number.isFinite(tid) && tid > 0) keys.add(tid);
    const ext = doc.external_ids && doc.external_ids.tmdb_id;
    const extn = Number(ext);
    if (Number.isFinite(extn) && extn > 0) keys.add(extn);
    if (!catalogId.startsWith("anime_")) {
      const idn = Number(doc.id);
      if (Number.isFinite(idn) && idn > 0) keys.add(idn);
    }
    for (const k of keys) {
      const cur = map.get(k);
      if (!cur) {
        map.set(k, catalogId);
        continue;
      }
      const curAnime = cur.startsWith("anime_");
      const nextAnime = catalogId.startsWith("anime_");
      if (nextAnime && !curAnime) map.set(k, catalogId);
    }
  }
  return map;
}

/**
 * @param {number[]} tmdbIds positive TMDB TV ids
 * @returns {Promise<Map<number, string>>}
 */
export async function catalogTvIdsByTmdbIds(tmdbIds) {
  const ids = [...new Set(tmdbIds.filter((n) => typeof n === "number" && n > 0))].slice(0, 24);
  if (ids.length === 0) return new Map();

  const client = await clientPromise;
  const col = client.db("teavie").collection("content");
  const idVariants = [...ids, ...ids.map(String)];
  const docs = await col
    .find(
      {
        type: "tv",
        $or: [
          { id: { $in: idVariants } },
          { tmdb_id: { $in: ids } },
          { "external_ids.tmdb_id": { $in: ids } },
        ],
      },
      { projection: { id: 1, tmdb_id: 1, external_ids: 1 } }
    )
    .limit(80)
    .toArray();

  return buildTmdbTvIdToCatalogIdMap(docs);
}
