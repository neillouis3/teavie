import clientPromise from "@/lib/mongo";
import {
  jikanFetchRelationsAndRecommendations,
  jikanPayloadsToCandidates,
} from "@/lib/jikanFetch";

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

const YOU_MIGHT_LIKE_MAX = 8;

/**
 * Jikan **recommendations** order, **Teavie catalog only** (no external-only tiles).
 *
 * GET `?idMal=` (MAL anime id) required.
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

    /** @type {Map<number, { catalogId: string }>} */
    const byMal = new Map();

    for (const d of docs) {
      const cid = String(d.id);
      if (!cid.startsWith("anime_")) continue;
      const m = typeof d.mal_id === "number" ? d.mal_id : null;
      if (m == null || !malIds.includes(m)) continue;
      if (!byMal.has(m)) byMal.set(m, { catalogId: cid });
    }

    const items = [];
    for (const c of candidates) {
      const row = byMal.get(c.malId) ?? null;
      if (row == null) continue;

      let title = c.title;
      let year = c.year;
      let posterPath = c.posterPath;
      const doc = docs.find((x) => String(x.id) === row.catalogId);
      if (doc) {
        title = doc.title ?? doc.name ?? title;
        year = yearFromDoc(doc);
        posterPath = doc.poster_path || posterPath;
      }

      const finalAl = doc != null ? docAnilistKey(doc) : null;

      items.push({
        catalogId: row.catalogId,
        malId: c.malId,
        anilistId:
          typeof finalAl === "number" && Number.isFinite(finalAl) && finalAl > 0 ? finalAl : null,
        title,
        year,
        posterPath,
        externalUrl: null,
      });
    }

    return Response.json({ items });
  } catch (e) {
    console.error(e);
    return Response.json({ items: [] }, { status: 200 });
  }
}
