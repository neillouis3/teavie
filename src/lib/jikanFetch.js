/**
 * Jikan v4 (api.jikan.moe) — same base as `scripts/import-anime-to-tv.js`.
 * Set `JIKAN_BASE` to override (e.g. self-hosted).
 */
const JIKAN_BASE =
  (typeof process !== "undefined" && process.env.JIKAN_BASE?.trim()?.replace(/\/$/, "")) ||
  "https://api.jikan.moe/v4";

const USER_AGENT =
  (typeof process !== "undefined" && process.env.JIKAN_UA?.trim()) ||
  "Teavie/1.0 (+https://github.com/neillouis3/teavie; catalog API)";

/**
 * @param {string} path e.g. `anime/21/relations` (no leading slash)
 */
export async function jikanGet(path) {
  const url = `${JIKAN_BASE}/${path.replace(/^\//, "")}`;
  return fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/json",
      "User-Agent": USER_AGENT,
    },
  });
}

export function jikanPosterFromEntry(entry) {
  const jpg = entry?.images?.jpg;
  const large =
    typeof jpg?.large_image_url === "string" ? jpg.large_image_url.trim() : "";
  const def =
    typeof jpg?.image_url === "string" ? jpg.image_url.trim() : "";
  return large || def || "";
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * @param {number} rootMal
 * @param {{ includeRelations?: boolean; includeRecommendations?: boolean; staggerMs?: number }} opts
 */
export async function jikanFetchRelationsAndRecommendations(rootMal, opts = {}) {
  const includeRelations = opts.includeRelations !== false;
  const includeRecommendations = opts.includeRecommendations !== false;
  const staggerMs = typeof opts.staggerMs === "number" ? opts.staggerMs : 400;

  let relationsStatus = 0;
  /** @type {unknown} */
  let relationsJson = null;
  if (includeRelations) {
    const relationsRes = await jikanGet(`anime/${rootMal}/relations`);
    relationsStatus = relationsRes.status;
    relationsJson = relationsRes.ok ? await relationsRes.json().catch(() => null) : null;
    if (includeRecommendations) await sleep(staggerMs);
  }

  let recsStatus = 0;
  /** @type {unknown} */
  let recsJson = null;
  if (includeRecommendations) {
    const recsRes = await jikanGet(`anime/${rootMal}/recommendations`);
    recsStatus = recsRes.status;
    recsJson = recsRes.ok ? await recsRes.json().catch(() => null) : null;
  }

  return {
    relationsJson,
    recsJson,
    relationsStatus,
    recsStatus,
  };
}

/** Jikan / MAL relation labels: direct franchise chain. */
export const FRANCHISE_RELATION_LABELS = new Set([
  "sequel",
  "prequel",
  "parent story",
  "parent",
]);

/**
 * Franchise / timeline relations we surface in “related” rails (Jikan `relation` strings are
 * lowercased for lookup). Includes alternates, side stories, spin-offs, summaries, etc.
 */
export const FRANCHISE_RELATION_LABELS_LOOSE = new Set([
  ...FRANCHISE_RELATION_LABELS,
  "alternative version",
  "alternative setting",
  "side story",
  "spin-off",
  "spin off",
  "character",
  "full story",
  "summary",
  "summaries",
  "adaptation",
  "other",
]);

/**
 * @param {string} relation raw label from Jikan
 */
export function isFranchiseRelationLabel(relation) {
  const r = String(relation || "")
    .trim()
    .toLowerCase();
  return FRANCHISE_RELATION_LABELS.has(r);
}

function normRelationLabel(s) {
  return String(s || "")
    .trim()
    .toLowerCase();
}

/** MAL lists animated movies as `movie`; TV/specials as `anime`. Recommendations often omit `type`. */
function isJikanAnimeOrMovieEntry(entry) {
  const t = String(entry?.type || "").toLowerCase();
  if (!t) return true;
  return t === "anime" || t === "movie";
}

/**
 * Franchise relation rows (no Jikan recommendations): sequel, prequel, parent, alternates,
 * side stories, spin-offs, summaries, character specials, etc. — TV and **movie** entries from MAL.
 * @param {number} rootMal
 * @param {unknown} relationsJson
 */
export function pickFranchiseRelationCandidates(rootMal, relationsJson) {
  const all = jikanPayloadsToCandidates(rootMal, relationsJson, null, {
    franchiseOnly: false,
    includeRecommendations: false,
  });
  return all.filter((c) => {
    const r = normRelationLabel(c.topNote);
    if (FRANCHISE_RELATION_LABELS_LOOSE.has(r)) return true;
    /** Jikan sometimes uses punctuation variants, e.g. `Spin-Off`. */
    const collapsed = r.replace(/[-\s._]/g, "");
    if (collapsed === "spinoff") return true;
    return false;
  });
}

/**
 * Outgoing **sequel** or **prequel** entries from one Jikan relations payload (`edgeNorm` = `sequel` | `prequel`).
 * @param {unknown} json
 * @param {string} edgeNorm
 * @returns {Array<{ malId: number; malKind: "anime" | "movie" }>}
 */
function edgeEntriesFromRelationsJson(json, edgeNorm) {
  /** @type {Array<{ malId: number; malKind: "anime" | "movie" }>} */
  const out = [];
  const data =
    json && typeof json === "object" && "data" in json
      ? /** @type {{ data?: unknown[] }} */ (json).data
      : null;
  if (!Array.isArray(data)) return out;
  const want = normRelationLabel(edgeNorm);
  for (const block of data) {
    if (normRelationLabel(block?.relation) !== want) continue;
    const entries = Array.isArray(block?.entry) ? block.entry : [];
    for (const entry of entries) {
      if (!isJikanAnimeOrMovieEntry(entry)) continue;
      const malId = Number(entry?.mal_id);
      if (!Number.isFinite(malId) || malId <= 0) continue;
      const malKind =
        String(entry?.type || "").toLowerCase() === "movie" ? "movie" : "anime";
      out.push({ malId, malKind });
    }
  }
  return out;
}

/** Relation groups on the **root** show where we surface linked theatrical / OVA **movies** only (no `side story` — those are handled separately for anime + movie). */
const ROOT_RELATED_MOVIE_RELATIONS = new Set([
  "summary",
  "sequel",
  "prequel",
  "alternative version",
  "parent story",
]);

/**
 * **Side story** links on the root title only — TV and movie entries (Jikan root relations).
 * @param {unknown} json
 * @param {number} rootMal
 */
function sideStoryStepsFromRootJson(json, rootMal) {
  /** @type {Array<{ malId: number; malKind: "anime" | "movie"; topNote: string }>} */
  const out = [];
  const seen = new Set([Number(rootMal)]);
  const data =
    json && typeof json === "object" && "data" in json
      ? /** @type {{ data?: unknown[] }} */ (json).data
      : null;
  if (!Array.isArray(data)) return out;
  for (const block of data) {
    if (normRelationLabel(block?.relation) !== "side story") continue;
    const topNote =
      typeof block?.relation === "string" && block.relation.trim()
        ? block.relation.trim()
        : "Side story";
    const entries = Array.isArray(block?.entry) ? block.entry : [];
    for (const entry of entries) {
      if (!isJikanAnimeOrMovieEntry(entry)) continue;
      const malId = Number(entry?.mal_id);
      if (!Number.isFinite(malId) || malId <= 0 || seen.has(malId)) continue;
      seen.add(malId);
      const malKind =
        String(entry?.type || "").toLowerCase() === "movie" ? "movie" : "anime";
      out.push({ malId, malKind, topNote });
    }
  }
  return out;
}

/**
 * Linked **movie** rows from the root show’s relations only (no extra Jikan hops).
 * @param {unknown} json
 * @param {number} rootMal
 * @returns {Array<{ malId: number; malKind: "movie"; topNote: string }>}
 */
function relatedMovieStepsFromRootJson(json, rootMal) {
  /** @type {Array<{ malId: number; malKind: "movie"; topNote: string }>} */
  const out = [];
  const seen = new Set([Number(rootMal)]);
  const data =
    json && typeof json === "object" && "data" in json
      ? /** @type {{ data?: unknown[] }} */ (json).data
      : null;
  if (!Array.isArray(data)) return out;
  for (const block of data) {
    const relNorm = normRelationLabel(block?.relation);
    if (!ROOT_RELATED_MOVIE_RELATIONS.has(relNorm)) continue;
    const topNote =
      typeof block?.relation === "string" && block.relation.trim()
        ? block.relation.trim()
        : "Movie";
    const entries = Array.isArray(block?.entry) ? block.entry : [];
    for (const entry of entries) {
      if (String(entry?.type || "").toLowerCase() !== "movie") continue;
      const malId = Number(entry?.mal_id);
      if (!Number.isFinite(malId) || malId <= 0 || seen.has(malId)) continue;
      seen.add(malId);
      out.push({ malId, malKind: /** @type {const} */ ("movie"), topNote });
    }
  }
  return out;
}

/**
 * BFS on one MAL relation edge (`sequel` or `prequel`) via Jikan.
 * @param {number} rootMal
 * @param {"sequel" | "prequel"} edgeNorm
 * @param {{ staggerMs?: number; maxHops?: number; maxNodes?: number; rootRelationsJson?: unknown; hadNetwork?: { v: boolean } }} [opts]
 */
async function jikanTransitiveEdgeChainOrdered(rootMal, edgeNorm, opts = {}) {
  const staggerMs = typeof opts.staggerMs === "number" ? opts.staggerMs : 400;
  const maxHops = typeof opts.maxHops === "number" ? opts.maxHops : 24;
  const maxNodes = typeof opts.maxNodes === "number" ? opts.maxNodes : 36;
  const root = Number(rootMal);
  if (!Number.isFinite(root) || root <= 0) return [];

  const rootJson = opts.rootRelationsJson;
  const hadNetwork = opts.hadNetwork ?? { v: false };

  /** @type {Array<{ malId: number; malKind: "anime" | "movie"; topNote: string }>} */
  const ordered = [];
  const seen = new Set([root]);
  /** @type {number[]} */
  let frontier = [root];
  let hops = 0;

  const topNote = edgeNorm === "prequel" ? "Prequel" : "Sequel";

  while (frontier.length && hops < maxHops && ordered.length < maxNodes) {
    hops++;
    /** @type {number[]} */
    const nextFrontier = [];
    for (const mal of frontier) {
      /** @type {unknown | null} */
      let json = null;
      if (mal === root && rootJson != null) {
        json = rootJson;
      } else {
        if (hadNetwork.v) await sleep(staggerMs);
        hadNetwork.v = true;
        const res = await jikanGet(`anime/${mal}/relations`);
        if (!res.ok) continue;
        json = await res.json().catch(() => null);
      }
      if (!json) continue;
      const pairs = edgeEntriesFromRelationsJson(json, edgeNorm);
      for (const { malId, malKind } of pairs) {
        if (!Number.isFinite(malId) || malId <= 0 || seen.has(malId)) continue;
        if (ordered.length >= maxNodes) break;
        seen.add(malId);
        ordered.push({ malId, malKind, topNote });
        nextFrontier.push(malId);
      }
      if (ordered.length >= maxNodes) break;
    }
    frontier = nextFrontier;
  }
  return ordered;
}

/**
 * Prequels (oldest → newer), sequels (forward), root **side stories** (anime + movie), then other
 * root-linked **movies**. Dedupes by `mal_id`.
 * @param {number} rootMal
 * @param {{ staggerMs?: number; maxHops?: number; maxNodes?: number }} [opts]
 * @returns {Promise<Array<{ malId: number; malKind: "anime" | "movie"; topNote: string }>>}
 */
export async function jikanFranchiseRailOrderedSteps(rootMal, opts = {}) {
  const root = Number(rootMal);
  if (!Number.isFinite(root) || root <= 0) return [];

  const staggerMs = typeof opts.staggerMs === "number" ? opts.staggerMs : 400;
  const hadNetwork = { v: false };

  let rootJson = null;
  {
    const res = await jikanGet(`anime/${root}/relations`);
    if (res.ok) rootJson = await res.json().catch(() => null);
    hadNetwork.v = true;
  }

  const sequel = await jikanTransitiveEdgeChainOrdered(root, "sequel", {
    ...opts,
    rootRelationsJson: rootJson,
    hadNetwork,
  });
  const prequelRaw = await jikanTransitiveEdgeChainOrdered(root, "prequel", {
    ...opts,
    rootRelationsJson: rootJson,
    hadNetwork,
  });
  const prequel = [...prequelRaw].reverse();
  const sideStories = sideStoryStepsFromRootJson(rootJson, root);
  const movies = relatedMovieStepsFromRootJson(rootJson, root);

  const seen = new Set([root]);
  /** @type {Array<{ malId: number; malKind: "anime" | "movie"; topNote: string }>} */
  const merged = [];
  const push = (
    /** @type {Array<{ malId: number; malKind: "anime" | "movie"; topNote: string }>} */ arr
  ) => {
    for (const s of arr) {
      if (seen.has(s.malId)) continue;
      seen.add(s.malId);
      merged.push(s);
    }
  };
  push(prequel);
  push(sequel);
  push(sideStories);
  push(movies);
  return merged;
}

/**
 * @deprecated Prefer {@link jikanFranchiseRailOrderedSteps}.
 * BFS on MAL **Sequel** links only (no shared root cache).
 */
export async function jikanTransitiveSequelChainOrdered(rootMal, opts = {}) {
  const hadNetwork = { v: false };
  const rows = await jikanTransitiveEdgeChainOrdered(Number(rootMal), "sequel", {
    staggerMs: opts.staggerMs,
    maxHops: opts.maxHops,
    maxNodes: typeof opts.maxSequels === "number" ? opts.maxSequels : 40,
    hadNetwork,
  });
  return rows.map(({ malId, malKind }) => ({ malId, malKind }));
}

/**
 * Jikan relations (+ optional recommendations) → unique anime rows (MAL id, note, title, poster).
 * @param {number} rootMal
 * @param {unknown} relationsPayload
 * @param {unknown} recsPayload
 * @param {{ franchiseOnly?: boolean; includeRecommendations?: boolean }} [opts]
 */
export function jikanPayloadsToCandidates(rootMal, relationsPayload, recsPayload, opts = {}) {
  const franchiseOnly = opts.franchiseOnly === true;
  const includeRecommendations =
    opts.includeRecommendations !== false && !franchiseOnly;

  const seen = new Set([rootMal]);
  /** @type {Array<{ malId: number; topNote: string; title: string; year: string; posterPath: string; malKind: "anime" | "movie" }>} */
  const out = [];

  const dataRel =
    relationsPayload && typeof relationsPayload === "object" && "data" in relationsPayload
      ? /** @type {{ data?: unknown[] }} */ (relationsPayload).data
      : null;
  if (Array.isArray(dataRel)) {
    for (const block of dataRel) {
      const relation =
        typeof block?.relation === "string" && block.relation.trim()
          ? block.relation.trim()
          : "Related";
      if (franchiseOnly && !isFranchiseRelationLabel(relation)) continue;
      const entries = Array.isArray(block?.entry) ? block.entry : [];
      for (const entry of entries) {
        if (!isJikanAnimeOrMovieEntry(entry)) continue;
        const malId = Number(entry?.mal_id);
        if (!Number.isFinite(malId) || malId <= 0 || seen.has(malId)) continue;
        seen.add(malId);
        const malKind = String(entry?.type || "").toLowerCase() === "movie" ? "movie" : "anime";
        const title =
          typeof entry?.name === "string" && entry.name.trim()
            ? entry.name.trim()
            : `MAL ${malId}`;
        out.push({
          malId,
          topNote: relation,
          title,
          year: "—",
          posterPath: jikanPosterFromEntry(entry),
          malKind,
        });
      }
    }
  }

  if (!includeRecommendations) return out;

  const dataRec =
    recsPayload && typeof recsPayload === "object" && "data" in recsPayload
      ? /** @type {{ data?: unknown[] }} */ (recsPayload).data
      : null;
  if (Array.isArray(dataRec)) {
    for (const row of dataRec) {
      const entry = row?.entry;
      if (!isJikanAnimeOrMovieEntry(entry)) continue;
      const malId = Number(entry?.mal_id);
      if (!Number.isFinite(malId) || malId <= 0 || seen.has(malId)) continue;
      seen.add(malId);
      const malKind = String(entry?.type || "").toLowerCase() === "movie" ? "movie" : "anime";
      const title =
        typeof entry?.title === "string" && entry.title.trim()
          ? entry.title.trim()
          : typeof entry?.name === "string" && entry.name.trim()
            ? entry.name.trim()
            : `MAL ${malId}`;
      out.push({
        malId,
        topNote: "Similar",
        title,
        year: "—",
        posterPath: jikanPosterFromEntry(entry),
        malKind,
      });
    }
  }

  return out;
}

export { JIKAN_BASE };
