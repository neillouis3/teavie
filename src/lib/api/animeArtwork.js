import { anilistPost } from "@/lib/anilistFetch";
import { jikanGet } from "@/lib/jikanFetch";

const DEFAULT_CHAR_IMAGE = "/character/large/default.";

/**
 * @param {unknown} row
 * @returns {string}
 */
function pictureUrlFromJikanRow(row) {
  if (!row || typeof row !== "object") return "";
  const jpg = /** @type {{ large_image_url?: string; image_url?: string }} */ (
    /** @type {{ jpg?: unknown }} */ (row).jpg
  );
  const webp = /** @type {{ large_image_url?: string; image_url?: string }} */ (
    /** @type {{ webp?: unknown }} */ (row).webp
  );
  const candidates = [
    jpg?.large_image_url,
    webp?.large_image_url,
    jpg?.image_url,
    webp?.image_url,
  ];
  for (const c of candidates) {
    if (typeof c === "string" && c.trim()) return c.trim();
  }
  return "";
}

/**
 * @param {number} idMal
 * @returns {Promise<{ url: string; source: string }[]>}
 */
async function artworkFromJikanPictures(idMal) {
  const res = await jikanGet(`anime/${idMal}/pictures`, { maxAttempts: 2 });
  if (!res.ok) return [];
  const json = await res.json().catch(() => null);
  const rows = Array.isArray(json?.data) ? json.data : [];
  /** @type {{ url: string; source: string }[]} */
  const out = [];
  const seen = new Set();
  for (const row of rows) {
    const url = pictureUrlFromJikanRow(row);
    if (!url || seen.has(url)) continue;
    seen.add(url);
    out.push({ url, source: "mal" });
  }
  return out;
}

/**
 * Cover / banner / character art when MAL pictures are unavailable.
 * @param {number} idMal
 * @returns {Promise<{ url: string; source: string; label?: string }[]>}
 */
async function artworkFromAnilist(idMal) {
  const query = `query ($idMal: Int) {
    Media(idMal: $idMal, type: ANIME) {
      coverImage { extraLarge large }
      bannerImage
      characters(page: 1, perPage: 40, sort: [ROLE]) {
        edges {
          role
          node {
            id
            name { full }
            image { large }
          }
        }
      }
    }
  }`;

  const res = await anilistPost({ query, variables: { idMal } });
  if (!res.ok) return [];
  const payload = await res.json().catch(() => null);
  const media = payload?.data?.Media;
  if (!media) return [];

  /** @type {{ url: string; source: string; label?: string }[]} */
  const out = [];
  const seen = new Set();

  /** @param {string | null | undefined} url @param {string} source @param {string} [label] */
  const push = (url, source, label) => {
    const u = typeof url === "string" ? url.trim() : "";
    if (!u || seen.has(u)) return;
    if (u.includes(DEFAULT_CHAR_IMAGE)) return;
    seen.add(u);
    out.push(label ? { url: u, source, label } : { url: u, source });
  };

  push(media.coverImage?.extraLarge || media.coverImage?.large, "anilist");
  push(media.bannerImage, "anilist");

  const edges = Array.isArray(media.characters?.edges)
    ? media.characters.edges
    : [];
  for (const edge of edges) {
    const node = edge?.node;
    const name =
      typeof node?.name?.full === "string" ? node.name.full.trim() : "";
    push(node?.image?.large, "character", name || undefined);
  }

  return out;
}

/**
 * Promo / character artwork for an anime show page.
 * Merges MAL pictures with AniList cover/banner/characters so a Jikan outage
 * still yields a gallery.
 *
 * @param {number} idMal
 * @returns {Promise<{ url: string; source: string; label?: string }[]>}
 */
export async function loadAnimeArtwork(idMal) {
  if (!Number.isFinite(idMal) || idMal <= 0) return [];

  const [malResult, aniResult] = await Promise.allSettled([
    artworkFromJikanPictures(idMal),
    artworkFromAnilist(idMal),
  ]);

  const fromMal = malResult.status === "fulfilled" ? malResult.value : [];
  const fromAni = aniResult.status === "fulfilled" ? aniResult.value : [];

  if (malResult.status === "rejected") {
    console.error("[animeArtwork] jikan pictures", malResult.reason);
  }
  if (aniResult.status === "rejected") {
    console.error("[animeArtwork] anilist fallback", aniResult.reason);
  }

  /** @type {{ url: string; source: string; label?: string }[]} */
  const out = [];
  const seen = new Set();
  for (const item of [...fromMal, ...fromAni]) {
    const url = typeof item?.url === "string" ? item.url.trim() : "";
    if (!url || seen.has(url)) continue;
    seen.add(url);
    out.push(item);
  }
  return out;
}
