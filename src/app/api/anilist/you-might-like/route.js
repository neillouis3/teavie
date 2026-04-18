import clientPromise from "@/lib/mongo";
import {
  jikanFetchRelationsAndRecommendations,
  jikanPayloadsToCandidates,
} from "@/lib/jikanFetch";
import { mapMalIdsToAnilistIds } from "@/lib/malToAnilistId";

function docAnilistKey(d) {
  const a = d?.anilist_id;
  if (typeof a === "number" && Number.isFinite(a) && a > 0) return a;
  if (typeof a === "string") {
    const n = parseInt(a, 10);
    if (Number.isFinite(n) && n > 0) return n;
  }
  const b = d?.anilist?.id;
  if (typeof b === "number" && Number.isFinite(b) && b > 0) return b;
  if (typeof b === "string") {
    const n = parseInt(b, 10);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return null;
}

function yearFromDoc(d) {
  const raw = d.release_date ?? d.first_air_date ?? "";
  if (typeof raw !== "string" || raw.length < 4) return "—";
  return raw.slice(0, 4);
}

function anilistUrlForAnime(anilistId) {
  return `https://anilist.co/anime/${anilistId}`;
}

const YOU_MIGHT_LIKE_MAX = 8;

/**
 * Recommendations from **Jikan** (MAL), merged with catalog; out-of-catalog tiles use **AniList** id/URL.
 *
 * GET `?idMal=` (MAL anime id) required. `anilistId` is ignored for the Jikan root (no AniList idMal lookup).
 */
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const malRaw = searchParams.get("idMal");
    const idMal = malRaw ? parseInt(malRaw, 10) : NaN;
    const useMal = Number.isFinite(idMal) && idMal > 0;

    if (!useMal) {
      return Response.json(
        { error: "Provide idMal (MAL anime id)", items: [] },
        { status: 400 }
      );
    }

    const rootMal = idMal;

    const jk = await jikanFetchRelationsAndRecommendations(rootMal, {
      includeRelations: false,
      includeRecommendations: true,
    });

    const candidates = jikanPayloadsToCandidates(rootMal, null, jk.recsJson).slice(
      0,
      YOU_MIGHT_LIKE_MAX
    );
    if (candidates.length === 0) {
      return Response.json({ items: [] });
    }

    const malIds = candidates.map((c) => c.malId);
    const client = await clientPromise;
    const docs = await client
      .db("teavie")
      .collection("content")
      .find(
        {
          type: "tv",
          id: { $regex: "^anime_" },
          mal_id: { $in: malIds },
        },
        {
          projection: {
            id: 1,
            anilist_id: 1,
            anilist: 1,
            mal_id: 1,
            title: 1,
            name: 1,
            poster_path: 1,
            first_air_date: 1,
            release_date: 1,
          },
        }
      )
      .limit(YOU_MIGHT_LIKE_MAX)
      .toArray();

    /** @type {Map<number, number>} */
    const malToAlFromMongo = new Map();
    /** @type {Map<number, { catalogId: string }>} */
    const byMal = new Map();

    for (const d of docs) {
      const cid = String(d.id);
      if (!cid.startsWith("anime_")) continue;
      const m = typeof d.mal_id === "number" ? d.mal_id : null;
      if (m == null || !malIds.includes(m)) continue;
      const ak = docAnilistKey(d);
      if (ak != null && !malToAlFromMongo.has(m)) malToAlFromMongo.set(m, ak);
      if (!byMal.has(m)) byMal.set(m, { catalogId: cid });
    }

    const malToAl = await mapMalIdsToAnilistIds(malIds, malToAlFromMongo, {
      concurrency: 6,
      pauseMs: 100,
    });

    const items = [];
    for (const c of candidates) {
      const row = byMal.get(c.malId) ?? null;
      const resolvedAl = malToAl.get(c.malId);
      const anilistNumeric =
        typeof resolvedAl === "number" && Number.isFinite(resolvedAl) && resolvedAl > 0
          ? resolvedAl
          : null;

      if (row == null && anilistNumeric == null) continue;

      let title = c.title;
      let year = c.year;
      let posterPath = c.posterPath;
      if (row) {
        const doc = docs.find((x) => String(x.id) === row.catalogId);
        if (doc) {
          title = doc.title ?? doc.name ?? title;
          year = yearFromDoc(doc);
          posterPath = doc.poster_path || posterPath;
        }
      }

      const docForRow = row ? docs.find((x) => String(x.id) === row.catalogId) : null;
      const fromDoc = docForRow != null ? docAnilistKey(docForRow) : null;
      const finalAl =
        anilistNumeric != null && anilistNumeric > 0
          ? anilistNumeric
          : fromDoc != null && fromDoc > 0
            ? fromDoc
            : null;

      if (row == null && finalAl == null) continue;

      const externalUrl =
        row == null && finalAl != null ? anilistUrlForAnime(finalAl) : null;

      items.push({
        catalogId: row?.catalogId ?? null,
        malId: c.malId,
        anilistId: finalAl,
        title,
        year,
        posterPath,
        externalUrl,
      });
    }

    return Response.json({ items });
  } catch (e) {
    console.error(e);
    return Response.json({ items: [] }, { status: 200 });
  }
}
