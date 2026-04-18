import clientPromise from "@/lib/mongo";
import { jikanFranchiseRailOrderedSteps } from "@/lib/jikanFetch";

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
 * Franchise rail from Jikan (MAL), **catalog-only**:
 * - Transitive **prequels** (oldest → newer toward the current show)
 * - Transitive **sequels** (forward chain)
 * - **Side stories** on the root (TV + movie)
 * - Other **movies** on the root (summary, sequel/prequel movie, alt version, parent story)
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
    const chain = await jikanFranchiseRailOrderedSteps(rootMal, {
      staggerMs: 400,
      maxHops: 24,
      maxNodes: 36,
    });

    /** @type {{ source: string; rootMal: number; stepCount: number; catalogMatches: number }} */
    const meta = {
      source: "jikan-franchise-rail",
      rootMal,
      stepCount: chain.length,
      catalogMatches: 0,
    };

    if (chain.length === 0) {
      const body = { items: [] };
      if (debug) body.meta = meta;
      return Response.json(body);
    }

    const malIds = chain.map((s) => s.malId);
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

    /** @type {Map<number, (typeof docs)[number]>} */
    const docByMal = new Map();
    for (const d of docs) {
      const m = typeof d.mal_id === "number" ? d.mal_id : null;
      if (m == null || !malIds.includes(m)) continue;
      if (!docByMal.has(m)) docByMal.set(m, d);
    }

    /** @type {Array<{ catalogId: string | null; catalogType: string | null; anilistId: number | null; malId: number; malKind: "anime" | "movie"; title: string; year: string; posterPath: string; topNote: string; externalUrl?: string | null }>} */
    const items = [];

    for (const step of chain) {
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
