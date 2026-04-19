import clientPromise from "@/lib/mongo";
import {
  jikanGet,
  jikanFranchiseRailOrderedSteps,
  pickFranchiseRelationCandidates,
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

/**
 * Related anime: franchise rail (transitive sequel / prequel chains, side stories, linked movies)
 * plus **direct** root relations (parent, alternative, etc.). **Teavie catalog only** — Mongo by `mal_id`.
 *
 * GET `?idMal=` (MAL id of the current show). Optional `?debug=1` for `meta`.
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
    const relRes = await jikanGet(`anime/${rootMal}/relations`);
    const relationsJson = relRes.ok ? await relRes.json().catch(() => null) : null;

    const direct = pickFranchiseRelationCandidates(rootMal, relationsJson);
    const chain = await jikanFranchiseRailOrderedSteps(rootMal, {
      rootRelationsJson: relationsJson,
      staggerMs: 350,
      maxNodes: 56,
    });

    const seenMal = new Set([rootMal]);
    /** @type {Array<{ malId: number; malKind: "anime" | "movie"; topNote: string }>} */
    const candidates = [];
    for (const s of chain) {
      if (!Number.isFinite(s.malId) || s.malId <= 0 || seenMal.has(s.malId)) continue;
      seenMal.add(s.malId);
      candidates.push(s);
    }
    for (const s of direct) {
      if (!Number.isFinite(s.malId) || s.malId <= 0 || seenMal.has(s.malId)) continue;
      seenMal.add(s.malId);
      candidates.push(s);
    }

    /** @type {{ source: string; rootMal: number; chainCount: number; directCount: number; mergedCount: number; catalogMatches: number }} */
    const meta = {
      source: "jikan-franchise-rail+direct-catalog",
      rootMal,
      chainCount: chain.length,
      directCount: direct.length,
      mergedCount: candidates.length,
      catalogMatches: 0,
    };

    if (candidates.length === 0) {
      const body = { items: [] };
      if (debug) body.meta = meta;
      return Response.json(body);
    }

    const malIds = candidates.map((s) => s.malId);
    const malIdsQuery = [...new Set([...malIds, ...malIds.map((n) => String(n))])];
    const client = await clientPromise;
    const col = client.db("teavie").collection("content");

    const docs = await col
      .find(
        {
          type: { $in: ["tv", "movie"] },
          mal_id: { $in: malIdsQuery },
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
      .limit(200)
      .toArray();

    /** @type {Map<number, (typeof docs)[number]>} */
    const docByMal = new Map();
    for (const d of docs) {
      const m = Number(d.mal_id);
      if (!Number.isFinite(m) || m <= 0 || !malIds.includes(m)) continue;
      if (!docByMal.has(m)) docByMal.set(m, d);
    }

    /** @type {Array<{ catalogId: string | null; catalogType: string | null; anilistId: number | null; malId: number; malKind: "anime" | "movie"; title: string; year: string; posterPath: string; topNote: string; externalUrl?: string | null }>} */
    const items = [];

    for (const step of candidates) {
      const d = docByMal.get(step.malId);
      if (!d) continue;
      const catalogId = String(d.id);
      const catalogType = d.type === "movie" ? "movie" : "tv";
      const al = docAnilistKey(d);
      items.push({
        catalogId,
        catalogType,
        anilistId: al,
        malId: step.malId,
        malKind: step.malKind,
        title: d.title ?? d.name ?? "Untitled",
        year: yearFromDoc(d),
        posterPath: typeof d.poster_path === "string" ? d.poster_path : "",
        topNote: step.topNote,
        externalUrl: null,
      });
    }

    meta.catalogMatches = items.length;

    const body = { items };
    if (debug) body.meta = meta;
    return Response.json(body);
  } catch (err) {
    console.error("[anilist/related]", err);
    return Response.json({ error: "related failed", items: [] }, { status: 500 });
  }
}
