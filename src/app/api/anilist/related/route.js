import clientPromise from "@/lib/mongo";
import {
  jikanFetchRelationsAndRecommendations,
  pickFranchiseRelationCandidates,
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

function malUrlForAnime(malId) {
  return `https://myanimelist.net/anime/${malId}`;
}

/**
 * Related in franchise: **Jikan** MAL relations — sequel, prequel, parent story, alternative version,
 * side story (no recommendations). Includes **anime** and **movie** entries. Out-of-catalog: AniList
 * when resolved, else MAL.
 *
 * GET `?idMal=` (MAL id) required for Jikan. `anilistId` is ignored for the Jikan root (no AniList idMal lookup).
 * Optional `?debug=1` for `meta`.
 */
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const debug = searchParams.get("debug") === "1";
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
    /** @type {{ source: string; rootMal: number; jikanRelationsStatus: number; jikanRecsStatus: number; candidateCount: number }} */
    const meta = {
      source: "jikan",
      rootMal,
      jikanRelationsStatus: 0,
      jikanRecsStatus: 0,
      candidateCount: 0,
    };

    const jk = await jikanFetchRelationsAndRecommendations(rootMal, {
      includeRecommendations: false,
    });
    meta.jikanRelationsStatus = jk.relationsStatus;
    meta.jikanRecsStatus = jk.recsStatus;

    const candidates = pickFranchiseRelationCandidates(rootMal, jk.relationsJson);
    meta.candidateCount = candidates.length;

    if (candidates.length === 0) {
      const body = { items: [] };
      if (debug) body.meta = meta;
      return Response.json(body);
    }

    const malIds = candidates.map((c) => c.malId);
    const client = await clientPromise;
    const col = client.db("teavie").collection("content");

    const docs = await col
      .find(
        {
          type: { $in: ["tv", "movie"] },
          mal_id: { $in: malIds },
        },
        {
          projection: {
            id: 1,
            type: 1,
            anilist_id: 1,
            anilist: 1,
            mal_id: 1,
            title: 1,
            name: 1,
            poster_path: 1,
            release_date: 1,
            first_air_date: 1,
          },
        }
      )
      .limit(120)
      .toArray();

    /** @type {Map<number, number>} */
    const malToAlFromMongo = new Map();
    /** @type {Map<number, { catalogId: string; catalogType: string }>} */
    const byMal = new Map();

    for (const d of docs) {
      const m = typeof d.mal_id === "number" ? d.mal_id : null;
      if (m == null || !malIds.includes(m)) continue;
      const ak = docAnilistKey(d);
      if (ak != null && !malToAlFromMongo.has(m)) malToAlFromMongo.set(m, ak);
      if (!byMal.has(m)) {
        byMal.set(m, {
          catalogId: String(d.id),
          catalogType: d.type === "movie" ? "movie" : "tv",
        });
      }
    }

    const malToAl = await mapMalIdsToAnilistIds(malIds, malToAlFromMongo, {
      concurrency: 6,
      pauseMs: 100,
    });

    /** @type {Array<{ catalogId: string | null; catalogType: string | null; anilistId: number | null; malId: number; malKind: "anime" | "movie"; title: string; year: string; posterPath: string; topNote: string; externalUrl?: string | null }>} */
    const items = [];

    for (const c of candidates) {
      const row = byMal.get(c.malId) ?? null;
      const resolvedAl = malToAl.get(c.malId);
      const anilistNumeric =
        typeof resolvedAl === "number" && Number.isFinite(resolvedAl) && resolvedAl > 0
          ? resolvedAl
          : null;

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

      let externalUrl = null;
      if (row == null) {
        externalUrl =
          anilistNumeric != null ? anilistUrlForAnime(anilistNumeric) : malUrlForAnime(c.malId);
      }

      const malKind = c.malKind === "movie" ? "movie" : "anime";
      items.push({
        catalogId: row?.catalogId ?? null,
        catalogType: row?.catalogType ?? null,
        anilistId: anilistNumeric,
        malId: c.malId,
        malKind,
        title,
        year,
        posterPath,
        topNote: c.topNote,
        externalUrl,
      });
    }

    const body = { items };
    if (debug) body.meta = meta;
    return Response.json(body);
  } catch (err) {
    console.error("[anilist/related]", err);
    return Response.json({ error: "related failed", items: [] }, { status: 500 });
  }
}
